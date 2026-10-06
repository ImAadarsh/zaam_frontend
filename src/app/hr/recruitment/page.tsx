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
  listJobPostings, createJobPosting, updateJobPosting,
  listApplicants, createApplicant, updateApplicant,
} from '@/lib/api';
import { APPLICANT_STAGES, formatDate, hrApiError, isApiMissing, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass, hrTextareaClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import { AlertTriangle, Briefcase, Eye, Plus, Users, X } from 'lucide-react';

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
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobOpen, setJobOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jobForm, setJobForm] = useState(EMPTY_JOB);
  const [appForm, setAppForm] = useState(EMPTY_APPLICANT);

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        listJobPostings({ organizationId: orgId, limit: 200 }),
        listApplicants({ organizationId: orgId, limit: 200 }),
      ]);
      setJobs(j.data || []);
      setApplicants(a.data || []);
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
        <Link href={`/hr/recruitment/jobs/${row.original.id}`} className="text-[#D4A017] hover:underline font-medium">
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
    },
    {
      id: 'status',
      accessorFn: (j) => j.status || '',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(row.original.status)}`}>{row.original.status}</span>
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
      header: 'Name',
      cell: ({ getValue }) => <span className="font-medium">{String(getValue() || '—')}</span>,
    },
    { id: 'email', accessorFn: (a) => a.email || '', header: 'Email', cell: ({ getValue }) => String(getValue() || '—') },
    { id: 'phone', accessorFn: (a) => a.phone || '', header: 'Phone', cell: ({ getValue }) => String(getValue() || '—') },
    {
      id: 'job',
      accessorFn: (a) => a.jobPosting?.title || '',
      header: 'Job',
      cell: ({ row }) => {
        const jid = row.original.jobPostingId || row.original.jobPosting?.id;
        return jid ? (
          <Link href={`/hr/recruitment/jobs/${jid}`} className="text-[#D4A017] hover:underline">{row.original.jobPosting?.title || `Job #${jid}`}</Link>
        ) : '—';
      },
    },
    {
      id: 'stage',
      accessorFn: (a) => a.stage || '',
      header: 'Stage',
      cell: ({ row }) => (
        <select
          className="h-8 rounded-lg border border-border/80 bg-background px-2 text-xs"
          value={row.original.stage || 'applied'}
          onChange={(e) => void moveStage(row.original.id, e.target.value)}
        >
          {APPLICANT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          {row.original.stage === 'withdrawn' && <option value="withdrawn">Withdrawn</option>}
        </select>
      ),
    },
    { id: 'createdAt', accessorFn: (a) => a.createdAt || '', header: 'Applied', cell: ({ row }) => formatDate(row.original.createdAt) },
  ], [moveStage]);

  const selectedJobTitle = selectedJob ? jobs.find((j) => String(j.id) === selectedJob)?.title : null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Recruitment" />
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
            <button type="button" onClick={() => openApplicant(selectedJob)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium">
              <Users size={14} /> Add applicant
            </button>
            <button type="button" onClick={openJob} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
              <Plus size={14} /> Create job
            </button>
          </div>

          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 font-semibold flex items-center gap-2">
              <Briefcase size={16} className="text-[#D4A017]" /> Jobs
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (
                <RichDataTable columns={jobColumns} data={jobs} searchPlaceholder="Search jobs…" />
              )}
            </div>
          </section>

          <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 font-semibold flex flex-wrap items-center gap-2">
              <Users size={16} className="text-[#D4A017]" /> Applicants
              {selectedJobTitle && (
                <button type="button" onClick={() => setSelectedJob(null)} className="ml-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#D4A017]/15 text-foreground">
                  {selectedJobTitle} <X size={12} />
                </button>
              )}
            </div>
            <div className="p-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (
                <RichDataTable columns={applicantColumns} data={visibleApplicants} searchPlaceholder="Search applicants…" />
              )}
            </div>
          </section>
        </main>
      </div>

      <HrModal open={jobOpen} onClose={() => setJobOpen(false)} title="Post a job" icon={Briefcase}>
        <form onSubmit={saveJob} className="space-y-4">
          <HrField label="Title"><input className={hrInputClass} required value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} /></HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Department"><input className={hrInputClass} value={jobForm.department} onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })} /></HrField>
            <HrField label="Location"><input className={hrInputClass} value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} /></HrField>
          </div>
          <HrField label="Employment type">
            <select className={hrInputClass} value={jobForm.employmentType} onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
            </select>
          </HrField>
          <HrField label="Description"><textarea className={hrTextareaClass} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setJobOpen(false)} submitLabel="Publish" submitting={saving} />
        </form>
      </HrModal>

      <HrModal open={appOpen} onClose={() => setAppOpen(false)} title="Add applicant" icon={Users}>
        <form onSubmit={saveApplicant} className="space-y-4">
          <HrField label="Job">
            <select className={hrInputClass} required value={appForm.jobPostingId} onChange={(e) => setAppForm({ ...appForm, jobPostingId: e.target.value })}>
              <option value="">Select…</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </HrField>
          <div className="grid grid-cols-2 gap-3">
            <HrField label="First name"><input className={hrInputClass} required value={appForm.firstName} onChange={(e) => setAppForm({ ...appForm, firstName: e.target.value })} /></HrField>
            <HrField label="Last name"><input className={hrInputClass} required value={appForm.lastName} onChange={(e) => setAppForm({ ...appForm, lastName: e.target.value })} /></HrField>
          </div>
          <HrField label="Email"><input type="email" autoComplete="off" className={hrInputClass} required value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })} /></HrField>
          <HrField label="Phone"><input className={hrInputClass} value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })} /></HrField>
          <HrField label="Stage">
            <select className={hrInputClass} value={appForm.stage} onChange={(e) => setAppForm({ ...appForm, stage: e.target.value })}>
              {APPLICANT_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </HrField>
          <HrField label="Notes"><textarea className={hrTextareaClass} value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setAppOpen(false)} submitLabel="Add" submitting={saving} />
        </form>
      </HrModal>
    </div>
  );
}
