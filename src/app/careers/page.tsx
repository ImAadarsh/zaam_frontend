'use client';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { listPublicJobs, applyPublicJob } from '@/lib/api';
import { FileUploadField } from '@/components/file-upload-field';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  X,
  Send,
  Sparkles,
  Search,
  ShieldCheck,
  Heart,
  Laptop,
  GraduationCap,
  Coins,
  Users,
  ExternalLink,
  ChevronRight,
  Globe2,
  Check,
  Calendar,
} from 'lucide-react';

export default function CareersPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [filterDept, setFilterDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    portfolioUrl: '',
    rtwStatus: 'uk_citizen',
    cvUrl: '',
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await listPublicJobs();
        setJobs(res.data || []);
      } catch (err: any) {
        toast.error('Could not load job postings. Please try again later.');
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const departments = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.department).filter(Boolean)));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchDept = filterDept === 'all' || j.department === filterDept;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        j.title?.toLowerCase().includes(q) ||
        j.department?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q);
      return matchDept && matchSearch;
    });
  }, [jobs, filterDept, searchQuery]);

  function openApply(job: any) {
    setSelectedJob(job);
    setSubmitted(false);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      linkedinUrl: '',
      portfolioUrl: '',
      rtwStatus: 'uk_citizen',
      cvUrl: '',
      notes: '',
    });
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob?.id) return;
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!form.email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setSubmitting(true);
    try {
      await applyPublicJob(selectedJob.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        cvUrl: form.cvUrl,
        notes: `[RTW: ${form.rtwStatus}] [LinkedIn: ${form.linkedinUrl || 'N/A'}] [Portfolio: ${form.portfolioUrl || 'N/A'}]\n\n${form.notes}`,
        jobPostingId: selectedJob.id,
      });
      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error?.message ||
          'Failed to submit application. Please check your information and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-sans selection:bg-[#D4A017]/25 selection:text-neutral-900">
      {/* Top Announcement Bar */}
      <div className="bg-neutral-950 text-white text-xs py-2.5 px-4 text-center font-medium border-b border-white/10 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>We are actively hiring across Product, Engineering, and Operations teams in the UK & globally.</span>
      </div>

      {/* Modern Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="relative h-9 w-32 block">
              <Image src="/brand/h-golden.png" alt="Zaam" fill className="object-contain object-left" priority />
            </Link>
            <div className="h-5 w-[1px] bg-neutral-300 hidden sm:block" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20">
              <Sparkles size={13} className="text-amber-600" /> Careers Portal
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
            <a href="#open-roles" className="hover:text-neutral-900 transition-colors">Open Positions</a>
            <a href="#benefits" className="hover:text-neutral-900 transition-colors">Benefits & Culture</a>
            <a href="#process" className="hover:text-neutral-900 transition-colors">Hiring Process</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-neutral-700 hover:text-neutral-900 px-3.5 py-2 rounded-xl border border-neutral-300/80 bg-white hover:bg-neutral-50 shadow-sm transition-all"
            >
              Employee Login →
            </Link>
            <a
              href="#open-roles"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white shadow-sm shadow-[#D4A017]/30 transition-all"
            >
              View Roles ({jobs.length})
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-20 border-b border-neutral-200/70">
        {/* Ambient warm lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-200/40 via-amber-100/10 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#D4A017]" />
            Shape The Future With Zaam
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-neutral-950 tracking-tight leading-[1.12]">
            Build technology that powers the next generation of commerce.
          </h1>

          <p className="text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            We are engineering the unified operating system for global B2B commerce, multi-currency finance, and intelligent enterprise automation. Join us to do the best work of your career.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#open-roles"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white font-semibold text-sm shadow-xl shadow-[#D4A017]/25 hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
            >
              Browse Open Roles <ArrowRight size={16} />
            </a>
            <a
              href="#benefits"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-sm border border-neutral-300 shadow-sm transition-all"
            >
              Why Work At Zaam?
            </a>
          </div>

          {/* Quick value badges */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
            <div className="p-3.5 rounded-2xl bg-white/80 border border-neutral-200/80 shadow-sm">
              <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Coins size={14} className="text-[#D4A017]" /> Top-Tier Pay
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">Competitive salary & equity</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 border border-neutral-200/80 shadow-sm">
              <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Globe2 size={14} className="text-[#D4A017]" /> Flexible Work
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">Hybrid & remote options</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 border border-neutral-200/80 shadow-sm">
              <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#D4A017]" /> Visa Support
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">UK sponsorship available</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 border border-neutral-200/80 shadow-sm">
              <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <Heart size={14} className="text-[#D4A017]" /> Health & Pension
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">Comprehensive coverage</div>
            </div>
          </div>
        </div>
      </section>

      {/* Perks & Benefits Grid */}
      <section id="benefits" className="py-20 max-w-6xl mx-auto px-6 border-b border-neutral-200/70">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#D4A017]">Perks & Wellbeing</span>
          <h2 className="text-3xl font-extrabold text-neutral-950">Designed for ambitious craftspeople</h2>
          <p className="text-sm text-neutral-600">
            We give our team the freedom, resources, and environment needed to do exceptional work without friction.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-[#D4A017] flex items-center justify-center">
              <Laptop size={24} />
            </div>
            <h3 className="font-bold text-base text-neutral-900">Modern Hardware & Workspace</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Top-of-the-line Apple Silicon MacBooks, high-resolution displays, and a home-office equipment budget.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Coins size={24} />
            </div>
            <h3 className="font-bold text-base text-neutral-900">Competitive Pay & Equity</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Regular market-adjusted salary reviews, transparent equity grants, and performance incentives.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <GraduationCap size={24} />
            </div>
            <h3 className="font-bold text-base text-neutral-900">Learning & Development</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Annual £1,500 personal development stipend for books, courses, conferences, and technical certifications.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Heart size={24} />
            </div>
            <h3 className="font-bold text-base text-neutral-900">Health, Leave & Pension</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              28 days paid annual leave + bank holidays, private medical insurance, and enhanced employer pension matching.
            </p>
          </div>
        </div>
      </section>

      {/* Main Job Board Section */}
      <section id="open-roles" className="py-20 max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4A017]">Join Our Team</span>
            <h2 className="text-3xl font-extrabold text-neutral-950 mt-1">Open Positions ({jobs.length})</h2>
            <p className="text-sm text-neutral-600 mt-1">
              No account or login required. Apply directly below and our recruitment team will reach out.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role or keyword…"
              className="w-full h-11 pl-10 pr-4 rounded-2xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#D4A017]/40 focus:border-[#D4A017] shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Department Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 border-b border-neutral-200/60 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterDept('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterDept === 'all'
                ? 'bg-neutral-950 text-white shadow-md'
                : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            All Departments ({jobs.length})
          </button>
          {departments.map((dept) => {
            const count = jobs.filter((j) => j.department === dept).length;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setFilterDept(dept)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterDept === dept
                    ? 'bg-neutral-950 text-white shadow-md'
                    : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                }`}
              >
                {dept} ({count})
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-3xl bg-neutral-200/60 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredJobs.length === 0 && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center max-w-md mx-auto my-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-[#D4A017] flex items-center justify-center mx-auto mb-4">
              <Briefcase size={26} />
            </div>
            <h3 className="font-bold text-lg text-neutral-900">No positions found</h3>
            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
              We couldn&apos;t find any roles matching your current search or filters. Try adjusting your query or view all departments.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  setFilterDept('all');
                  setSearchQuery('');
                }}
                className="h-10 px-5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* Job Cards List */}
        {!loading && filteredJobs.length > 0 && (
          <div className="grid gap-4 sm:gap-5">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="group relative rounded-3xl border border-neutral-200/90 bg-white hover:border-[#D4A017]/60 p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {job.department && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-500/20">
                        {job.department}
                      </span>
                    )}
                    {job.location && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                        <MapPin size={12} className="text-neutral-500" /> {job.location}
                      </span>
                    )}
                    {job.employmentType && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 capitalize">
                        <Clock size={12} className="text-neutral-500" /> {job.employmentType.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 group-hover:text-[#c49415] transition-colors">
                      {job.title}
                    </h3>
                    {job.description && (
                      <p className="text-sm text-neutral-600 line-clamp-2 max-w-3xl mt-1.5 leading-relaxed">
                        {job.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-neutral-500 font-medium">
                    <span>Competitive salary + equity</span>
                    <span>•</span>
                    <span>UK Sponsorship Eligible</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => openApply(job)}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-bold shadow-md shadow-[#D4A017]/25 hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                  >
                    Apply Now <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hiring Process Section */}
      <section id="process" className="py-20 bg-white border-y border-neutral-200/70">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4A017]">Transparent & Fast</span>
            <h2 className="text-3xl font-extrabold text-neutral-950">Our 4-Step Hiring Process</h2>
            <p className="text-sm text-neutral-600">
              We respect your time. Our hiring process is streamlined, collaborative, and typically takes 10 to 14 days from first application to formal offer.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-6 rounded-3xl bg-[#FDFBF7] border border-neutral-200/80 space-y-3 relative">
              <span className="text-3xl font-black text-amber-500/40">01</span>
              <h3 className="font-bold text-base text-neutral-900">Application Review</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Our talent team reviews your application, CV, and background within 48 business hours.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#FDFBF7] border border-neutral-200/80 space-y-3 relative">
              <span className="text-3xl font-black text-amber-500/40">02</span>
              <h3 className="font-bold text-base text-neutral-900">Discovery Chat</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                A 30-minute introductory video call to discuss your aspirations, our culture, and role alignment.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#FDFBF7] border border-neutral-200/80 space-y-3 relative">
              <span className="text-3xl font-black text-amber-500/40">03</span>
              <h3 className="font-bold text-base text-neutral-900">Technical Deep Dive</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                A real-world practical conversation with the engineering or domain team. No trick leetcode questions.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[#FDFBF7] border border-neutral-200/80 space-y-3 relative">
              <span className="text-3xl font-black text-amber-500/40">04</span>
              <h3 className="font-bold text-base text-neutral-900">Offer & Welcome</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Meet leadership, review a competitive compensation package, and start your seamless onboarding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Application Slide-over / Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              type="button"
              onClick={() => setSelectedJob(null)}
              className="absolute top-5 right-5 p-2 rounded-2xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-900 border border-amber-500/20">
                <Briefcase size={13} className="text-[#D4A017]" /> Application for Position
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-950 mt-2">
                {selectedJob.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 mt-2">
                {selectedJob.department && (
                  <span className="inline-flex items-center gap-1 font-semibold text-neutral-800">
                    <Building2 size={13} className="text-[#D4A017]" /> {selectedJob.department}
                  </span>
                )}
                {selectedJob.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} className="text-[#D4A017]" /> {selectedJob.location}
                  </span>
                )}
                {selectedJob.employmentType && (
                  <span className="inline-flex items-center gap-1 capitalize">
                    <Clock size={13} className="text-[#D4A017]" /> {selectedJob.employmentType.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>

            {submitted ? (
              <div className="py-10 text-center space-y-4">
                <div className="w-18 h-18 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={44} />
                </div>
                <h3 className="text-2xl font-black text-neutral-950">Application Received!</h3>
                <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{form.firstName}</strong>. Your application for <strong>{selectedJob.title}</strong> has been logged in our system. We will contact you at <strong>{form.email}</strong> regarding the next steps.
                </p>
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="h-11 px-7 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold shadow-md transition-colors"
                  >
                    Close & View More Opportunities
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">First Name *</label>
                    <input
                      type="text"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      placeholder="e.g. Amit"
                      className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      placeholder="e.g. Kumar"
                      className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="amit.kumar@example.com"
                      className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+44 7123 456789"
                      className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">LinkedIn Profile URL</label>
                    <input
                      type="url"
                      value={form.linkedinUrl}
                      onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1.5">GitHub / Portfolio Website</label>
                    <input
                      type="url"
                      value={form.portfolioUrl}
                      onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
                      placeholder="https://github.com/..."
                      className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">UK Right to Work / Visa Status</label>
                  <select
                    value={form.rtwStatus}
                    onChange={(e) => setForm({ ...form, rtwStatus: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all"
                  >
                    <option value="uk_citizen">British / Irish Citizen</option>
                    <option value="settled_status">EU Settled / Pre-Settled Status</option>
                    <option value="skilled_worker_transfer">Skilled Worker Visa (Require Transfer/Sponsorship)</option>
                    <option value="graduate_visa">UK Graduate / Post-Study Work Visa</option>
                    <option value="student_visa">UK Student Visa (Part-Time Eligible)</option>
                    <option value="other">Other / Need Sponsorship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">Resume / CV Document</label>
                  <FileUploadField
                    value={form.cvUrl ? [form.cvUrl] : []}
                    onChange={(urls) => setForm({ ...form, cvUrl: urls[0] || '' })}
                    folder="hr/cv"
                    accept=".pdf,.doc,.docx"
                    label="Upload your CV (PDF or Word, max 20MB)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">Cover Letter / Note to Hiring Manager</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Tell us briefly about your experience, past projects, and why you are interested in joining Zaam…"
                    className="w-full p-3.5 rounded-xl border border-neutral-300 bg-neutral-50/60 text-sm text-neutral-900 focus:bg-white focus:border-[#D4A017] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/20 transition-all resize-none"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="h-11 px-5 rounded-xl text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 h-11 px-7 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-xs font-bold shadow-lg shadow-[#D4A017]/25 disabled:opacity-50 transition-all"
                  >
                    {submitting ? 'Submitting…' : <><Send size={14} /> Submit Application</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modern Enterprise Footer */}
      <footer className="border-t border-neutral-200/80 bg-white py-12 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-7 w-24">
                <Image src="/brand/h-golden.png" alt="Zaam" fill className="object-contain object-left" />
              </div>
              <span className="text-neutral-400">·</span>
              <span>Global Enterprise Software & Fintech Platform</span>
            </div>

            <div className="flex items-center gap-6 font-medium">
              <a href="#open-roles" className="hover:text-neutral-900 transition-colors">Jobs</a>
              <a href="#benefits" className="hover:text-neutral-900 transition-colors">Perks</a>
              <a href="#process" className="hover:text-neutral-900 transition-colors">Process</a>
              <Link href="/login" className="hover:text-neutral-900 transition-colors">Employee Portal</Link>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-400 text-[11px]">
            <div>© {new Date().getFullYear()} Zaam AI Technologies Ltd. All rights reserved. Registered in England & Wales.</div>
            <div>Equal Opportunity Employer · London · Global</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
