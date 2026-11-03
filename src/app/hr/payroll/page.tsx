'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { useApiAccess } from '@/hooks/use-api-access';
import {
  listPayrollRuns, createPayrollRun, listPayrollLines, listPayslips,
  listTaxDocuments, createTaxDocument, listEmployees, listBusinessUnits,
} from '@/lib/api';
import { employeeName, formatDate, formatMoney, hrApiError, isApiMissing, statusBadgeClass } from '@/lib/hr-utils';
import { HrModal, HrField, HrModalActions, hrInputClass } from '@/components/hr/hr-modal';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { DollarSign, FileText, Plus } from 'lucide-react';

export default function PayrollPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'HR_MANAGER', 'HR_ADMIN']);
  const { can } = useApiAccess();
  const canCreateRun = can('POST', '/api/hr/payroll-runs');
  const canCreateTaxDoc = can('POST', '/api/hr/tax-documents');
  const [tab, setTab] = useState<'runs' | 'payslips' | 'tax'>('runs');
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [taxDocs, setTaxDocs] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [bus, setBus] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    organizationId: '',
    businessUnitId: '',
    payrollNumber: '',
    periodStart: '',
    periodEnd: '',
    paymentDate: '',
    currency: 'GBP',
  });
  const [taxForm, setTaxForm] = useState({
    employeeId: '',
    documentType: 'P60',
    taxYear: '',
    documentUrl: '',
    documentName: '',
  });

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        listPayrollRuns({ organizationId: orgId }),
        listEmployees({ organizationId: orgId }),
      ]);
      setRuns(r.data || []);
      setEmployees(e.data || []);
      if (orgId) {
        setForm((f) => ({ ...f, organizationId: orgId }));
        try {
          const bu = await listBusinessUnits(orgId);
          setBus(bu.data || []);
        } catch { setBus([]); }
      }
      try {
        const p = await listPayslips({ organizationId: orgId, limit: 100 });
        setPayslips(p.data || []);
      } catch {
        // Fallback: payroll lines as payslip proxy
        try {
          const pl = await listPayrollLines({ limit: 100 });
          setPayslips((pl.data || []).map((l: any) => ({
            id: l.id,
            employee: l.employee,
            periodLabel: l.payrollRun?.payrollNumber,
            netPay: l.netPay ?? (Number(l.grossPay) - Number(l.taxDeduction || 0) - Number(l.nationalInsurance || 0) - Number(l.pensionDeduction || 0)),
            grossPay: l.grossPay,
            taxDeduction: l.taxDeduction,
            nationalInsurance: l.nationalInsurance,
            payslipUrl: l.payslipUrl,
            payrollRun: l.payrollRun,
          })));
        } catch { setPayslips([]); }
      }
      try {
        const t = await listTaxDocuments({ organizationId: orgId });
        setTaxDocs(t.data || []);
      } catch { setTaxDocs([]); }
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to load payroll'));
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

  useEffect(() => {
    if (!selectedRun) {
      setLines([]);
      return;
    }
    (async () => {
      try {
        const res = await listPayrollLines({ payrollRunId: selectedRun });
        setLines(res.data || []);
      } catch {
        setLines([]);
      }
    })();
  }, [selectedRun]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createPayrollRun({
        organizationId: form.organizationId,
        businessUnitId: form.businessUnitId || undefined,
        payrollNumber: form.payrollNumber,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        paymentDate: form.paymentDate,
        currency: form.currency,
      });
      toast.success('Payroll run created');
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(hrApiError(err, 'Failed to create run'));
    } finally {
      setSaving(false);
    }
  }

  async function onTax(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createTaxDocument({
        employeeId: taxForm.employeeId,
        organizationId: orgId,
        docType: taxForm.documentType,
        taxYear: taxForm.taxYear,
        documentUrl: taxForm.documentUrl,
        documentName: taxForm.documentName || `${taxForm.documentType} ${taxForm.taxYear}`,
      });
      toast.success('Tax document saved');
      setTaxOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiMissing(err) ? 'Tax documents API not live yet' : hrApiError(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  const runColumns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: 'payrollNumber', header: 'Run #' },
    { header: 'Period', cell: ({ row }) => `${formatDate(row.original.periodStart)} – ${formatDate(row.original.periodEnd)}` },
    { header: 'Pay date', cell: ({ row }) => formatDate(row.original.paymentDate) },
    { header: 'Gross', cell: ({ row }) => formatMoney(row.original.totalGross, row.original.currency) },
    { header: 'Net', cell: ({ row }) => formatMoney(row.original.totalNet, row.original.currency) },
    { accessorKey: 'employeeCount', header: 'Staff' },
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
      id: 'open',
      header: '',
      cell: ({ row }) => (
        <button type="button" className="text-xs text-[#D4A017] hover:underline" onClick={() => setSelectedRun(row.original.id)}>
          Lines
        </button>
      ),
    },
  ], []);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="HR · Payroll" />
        <main className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {(['runs', 'payslips', 'tax'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`h-10 px-4 rounded-xl text-sm font-medium capitalize ${tab === t ? 'bg-[#D4A017]/15 ring-1 ring-[#D4A017]/30' : 'bg-muted'}`}
                >
                  {t === 'tax' ? 'P45 / P60' : t}
                </button>
              ))}
            </div>
            {tab === 'runs' && canCreateRun && (
              <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
                <Plus size={14} /> Create payroll run
              </button>
            )}
            {tab === 'tax' && canCreateTaxDoc && (
              <button type="button" onClick={() => setTaxOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
                <Plus size={14} /> Add P45/P60
              </button>
            )}
            {tab === 'payslips' && canCreateRun && (
              <button type="button" onClick={() => { setTab('runs'); setOpen(true); }} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white text-sm font-medium shadow-lg shadow-[#D4A017]/20">
                <Plus size={14} /> Create payroll run
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            PAYE / NI figures are operational support for UK payroll — not a certified HMRC RTI submission.
          </p>

          {tab === 'runs' && (
            <>
              <RichDataTable columns={runColumns} data={runs} searchPlaceholder="Search runs…" />
              {selectedRun && (
                <section className="glass-panel rounded-2xl border border-border/50 overflow-hidden mt-6">
                  <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">Payroll Run Breakdown</span>
                      <span className="text-xs text-muted-foreground ml-2">({lines.length} employee lines)</span>
                    </div>
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground font-medium" onClick={() => setSelectedRun(null)}>Close</button>
                  </div>
                  {lines.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground">No lines for this run.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3">Employee</th>
                            <th className="px-5 py-3">Gross Pay</th>
                            <th className="px-5 py-3">PAYE Tax</th>
                            <th className="px-5 py-3">Employee NI</th>
                            <th className="px-5 py-3">Pension (5%)</th>
                            <th className="px-5 py-3">Net Pay</th>
                            <th className="px-5 py-3">Employer Costs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {lines.map((l: any) => (
                            <tr key={l.id} className="hover:bg-muted/20">
                              <td className="px-5 py-3.5 font-medium">
                                <div>{employeeName(l.employee)}</div>
                                <div className="text-xs text-muted-foreground">{l.employee?.jobTitle || l.notes || '—'}</div>
                              </td>
                              <td className="px-5 py-3.5 font-medium">{formatMoney(l.grossPay)}</td>
                              <td className="px-5 py-3.5 text-rose-600 font-mono">-{formatMoney(l.taxDeduction)}</td>
                              <td className="px-5 py-3.5 text-rose-600 font-mono">-{formatMoney(l.nationalInsurance)}</td>
                              <td className="px-5 py-3.5 text-rose-600 font-mono">-{formatMoney(l.pensionDeduction)}</td>
                              <td className="px-5 py-3.5 font-bold text-[#D4A017]">{formatMoney(l.netPay ?? (Number(l.grossPay) - Number(l.taxDeduction || 0) - Number(l.nationalInsurance || 0) - Number(l.pensionDeduction || 0)))}</td>
                              <td className="px-5 py-3.5 text-xs text-muted-foreground">
                                NI: {formatMoney(l.employerNi)} · Pen: {formatMoney(l.employerPension)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {tab === 'payslips' && (
            <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
              {payslips.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No payslips yet.</div>}
              {payslips.map((p: any) => (
                <div key={p.id} className="px-5 py-4 border-b border-border/30 last:border-0 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-semibold text-base">{employeeName(p.employee)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.periodLabel || (p.payPeriodStart ? `${formatDate(p.payPeriodStart)} – ${formatDate(p.payPeriodEnd)} (${p.taxYear || '2026/27'})` : p.payrollRun?.payrollNumber || 'Monthly Period')}
                      {p.grossPay && <span className="ml-2 font-medium">· Gross {formatMoney(p.grossPay)}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-base text-[#D4A017]">{formatMoney(p.netPay ?? p.net)}</div>
                    {(p.documentUrl || p.payslipUrl) && (
                      <a href={p.documentUrl || p.payslipUrl} target="_blank" rel="noreferrer" className="text-xs text-[#D4A017] font-semibold hover:underline inline-flex items-center gap-1 mt-0.5">
                        Download / View Payslip →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'tax' && (
            <div className="glass-panel rounded-2xl border border-border/50 overflow-hidden">
              {taxDocs.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">P45/P60 library empty — add documents when ready.</div>}
              {taxDocs.map((d: any) => (
                <div key={d.id} className="px-5 py-3 border-b border-border/30 last:border-0 flex justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium uppercase">{d.docType || d.documentType} · {d.taxYear || '—'}</div>
                    <div className="text-xs text-muted-foreground">{employeeName(d.employee)} · {d.documentName}</div>
                  </div>
                  {d.documentUrl && <a href={d.documentUrl} className="text-[#D4A017] text-xs hover:underline" target="_blank" rel="noreferrer">Open</a>}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <HrModal open={open} onClose={() => setOpen(false)} title="New payroll run" icon={DollarSign}>
        <form onSubmit={onCreate} className="space-y-4">
          <HrField label="Payroll number"><input className={hrInputClass} required value={form.payrollNumber} onChange={(e) => setForm({ ...form, payrollNumber: e.target.value })} placeholder="PR-2026-03" /></HrField>
          {bus.length > 0 && (
            <HrField label="Business unit">
              <select className={hrInputClass} value={form.businessUnitId} onChange={(e) => setForm({ ...form, businessUnitId: e.target.value })}>
                <option value="">All</option>
                {bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </HrField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <HrField label="Period start"><input type="date" className={hrInputClass} required value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} /></HrField>
            <HrField label="Period end"><input type="date" className={hrInputClass} required value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} /></HrField>
          </div>
          <HrField label="Payment date"><input type="date" className={hrInputClass} required value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></HrField>
          <HrModalActions onCancel={() => setOpen(false)} submitLabel="Create" submitting={saving} />
        </form>
      </HrModal>

      <HrModal open={taxOpen} onClose={() => setTaxOpen(false)} title="Add P45 / P60" icon={FileText}>
        <form onSubmit={onTax} className="space-y-4">
          <HrField label="Employee">
            <select className={hrInputClass} required value={taxForm.employeeId} onChange={(e) => setTaxForm({ ...taxForm, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
            </select>
          </HrField>
          <HrField label="Type">
            <select className={hrInputClass} value={taxForm.documentType} onChange={(e) => setTaxForm({ ...taxForm, documentType: e.target.value })}>
              <option value="P45">P45</option>
              <option value="P60">P60</option>
              <option value="P11D">P11D</option>
            </select>
          </HrField>
          <HrField label="Tax year"><input className={hrInputClass} required placeholder="2025/26" value={taxForm.taxYear} onChange={(e) => setTaxForm({ ...taxForm, taxYear: e.target.value })} /></HrField>
          <HrField label="Document name"><input className={hrInputClass} value={taxForm.documentName} onChange={(e) => setTaxForm({ ...taxForm, documentName: e.target.value })} /></HrField>
          <HrField label="Document URL"><input className={hrInputClass} required value={taxForm.documentUrl} onChange={(e) => setTaxForm({ ...taxForm, documentUrl: e.target.value })} placeholder="https://…" /></HrField>
          <HrModalActions onCancel={() => setTaxOpen(false)} submitLabel="Save" submitting={saving} />
        </form>
      </HrModal>
    </div>
  );
}
