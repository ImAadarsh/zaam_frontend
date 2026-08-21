'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { FilterBar, type FilterField } from '@/components/filter-bar';
import { useSession } from '@/hooks/use-session';
import {
  listCrmLeads, createCrmLead, updateCrmLead, convertCrmLead, listCrmPipelines
} from '@/lib/api';
import { crmApiError, displayName, LEAD_SOURCES, LEAD_STATUSES } from '@/lib/crm-utils';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, ArrowRightLeft, AlertCircle, Target, Send } from 'lucide-react';
import { CrmModal, CrmField, CrmModalActions, crmInputClass, crmTextareaClass } from '@/components/crm/crm-modal';

const emptyForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  source: 'website',
  status: 'new',
  notes: '',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'qualified':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'contacted':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'new':
      return 'bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/25';
    case 'converted':
      return 'bg-zaam-500/10 text-zaam-600 border-zaam-500/20';
    case 'lost':
    case 'unqualified':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    default:
      return 'bg-muted/40 text-muted-foreground border-border';
  }
}

export default function CrmLeadsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [apiMissing, setApiMissing] = useState(false);
  const [modal, setModal] = useState<'create' | 'edit' | 'convert' | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [convertForm, setConvertForm] = useState({
    createDeal: true,
    dealName: '',
    pipelineId: '',
    stageId: '',
    dealAmount: '',
    currency: 'GBP',
  });
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const orgId = session?.user?.organizationId;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await listCrmLeads({
        organizationId: orgId,
        search: search || undefined,
        status: filters.status || undefined,
      });
      setItems(res.data || []);
      setApiMissing(false);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setApiMissing(true);
        setItems([]);
      } else {
        toast.error(crmApiError(err, 'Failed to load leads'));
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, search, filters]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, session?.accessToken, router, load]);

  useEffect(() => {
    if (modal !== 'convert' || !orgId) return;
    listCrmPipelines({ organizationId: orgId })
      .then((r) => {
        const list = r.data || [];
        setPipelines(list);
        const def = list.find((p: any) => p.isDefault) || list[0];
        if (def) {
          setConvertForm((f) => ({
            ...f,
            pipelineId: def.id,
            stageId: def.stages?.[0]?.id || '',
          }));
        }
      })
      .catch(() => setPipelines([]));
  }, [modal, orgId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModal('create');
  }

  function openEdit(lead: any) {
    setEditing(lead);
    setForm({
      name: lead.name || '',
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || 'website',
      status: lead.status || 'new',
      notes: lead.notes || '',
    });
    setModal('edit');
  }

  function openConvert(lead: any) {
    setEditing(lead);
    setConvertForm({
      createDeal: true,
      dealName: lead.company ? `${lead.company} opportunity` : `Deal — ${lead.name}`,
      pipelineId: '',
      stageId: '',
      dealAmount: '',
      currency: 'GBP',
    });
    setModal('convert');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source,
      status: form.status,
      notes: form.notes || null,
      ownerUserId: session?.user?.id,
    };
    try {
      if (modal === 'edit' && editing) {
        await updateCrmLead(editing.id, payload);
        toast.success('Lead updated');
      } else {
        await createCrmLead({ organizationId: orgId, ...payload });
        toast.success('Lead created');
      }
      setModal(null);
      void load();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to save lead'));
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const res = await convertCrmLead(editing.id, {
        createDeal: convertForm.createDeal,
        dealName: convertForm.dealName || undefined,
        dealAmount: convertForm.dealAmount ? Number(convertForm.dealAmount) : undefined,
        currency: convertForm.currency,
        pipelineId: convertForm.pipelineId || undefined,
        stageId: convertForm.stageId || undefined,
        ownerUserId: session?.user?.id,
      });
      toast.success('Lead converted');
      setModal(null);
      if (res.data?.customer?.id) router.push(`/crm/accounts/${res.data.customer.id}`);
      else if (res.data?.deal?.id) router.push(`/crm/deals/${res.data.deal.id}`);
      else void load();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to convert lead'));
    } finally {
      setSaving(false);
    }
  }

  const filterFields = useMemo<FilterField[]>(() => [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      primary: true,
      options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    },
  ], []);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Lead',
      cell: (info) => <span className="font-semibold">{(info.getValue() as string) || displayName(info.row.original)}</span>,
    },
    { accessorKey: 'company', header: 'Company', cell: (i) => (i.getValue() as string) || '—' },
    { accessorKey: 'email', header: 'Email', cell: (i) => (i.getValue() as string) || '—' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const val = String(info.getValue() || '');
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusBadgeClass(val)}`}>
            {val}
          </span>
        );
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: (i) => (
        <span className="text-xs text-muted-foreground capitalize">{String(i.getValue() || '—').replace(/_/g, ' ')}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: (i) => (i.getValue() ? new Date(i.getValue() as string).toLocaleDateString() : '—'),
    },
    {
      id: 'actions',
      header: '',
      cell: (info) => {
        const lead = info.row.original;
        return (
          <div className="flex items-center gap-1 justify-end">
            {lead.status !== 'converted' && (
              <button type="button" title="Convert" onClick={() => openConvert(lead)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-[#D4A017]">
                <ArrowRightLeft size={16} />
              </button>
            )}
            <button type="button" title="Edit" onClick={() => openEdit(lead)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <Pencil size={16} />
            </button>
          </div>
        );
      },
    },
  ], []);

  const selectedPipeline = pipelines.find((p) => p.id === convertForm.pipelineId);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="Leads" actions={[{ label: 'New Lead', onClick: openCreate, icon: <Plus size={18} /> }]} />
        <main className="p-6 md:p-8 space-y-5">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Leads API not ready</div>
                <div className="text-xs mt-0.5 opacity-80">Waiting on <code className="font-mono">/api/crm/leads</code>.</div>
              </div>
            </div>
          )}

          <FilterBar
            fields={filterFields}
            values={filters}
            onChange={setFilters}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search leads…"
            stats={[{ label: 'Leads', value: loading ? '…' : String(items.length) }]}
            loading={loading}
          />

          {!loading && items.length === 0 && !apiMissing ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground">
              <Target className="mx-auto mb-3 opacity-40" size={32} />
              <p className="font-medium text-foreground">No leads yet</p>
              <p className="text-sm mt-1">Capture inbound interest and convert qualified leads into accounts and deals.</p>
            </div>
          ) : (
            <RichDataTable data={items} columns={columns} hideSearch />
          )}
        </main>
      </div>

      <CrmModal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Edit Lead' : 'New Lead'}
        icon={modal === 'edit' ? Pencil : Plus}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <CrmField label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={crmInputClass}
              placeholder="e.g. Aisha Khan"
            />
          </CrmField>
          <CrmField label="Company">
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className={crmInputClass}
              placeholder="e.g. Khan Convenience"
            />
          </CrmField>
          <div className="grid grid-cols-2 gap-4">
            <CrmField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={crmInputClass}
                placeholder="name@example.com"
              />
            </CrmField>
            <CrmField label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={crmInputClass}
                placeholder="+44…"
              />
            </CrmField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CrmField label="Source">
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={crmInputClass}>
                {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </CrmField>
            <CrmField label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={crmInputClass}>
                {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </CrmField>
          </div>
          <CrmField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={crmTextareaClass}
              placeholder="Context, next steps…"
            />
          </CrmField>
          <CrmModalActions
            onCancel={() => setModal(null)}
            submitLabel={modal === 'edit' ? 'Save Lead' : 'Create Lead'}
            submitting={saving}
            submitIcon={<Send size={16} />}
          />
        </form>
      </CrmModal>

      <CrmModal open={modal === 'convert' && !!editing} onClose={() => setModal(null)} title={editing ? `Convert ${editing.name}` : 'Convert'} icon={ArrowRightLeft}>
        <form onSubmit={handleConvert} className="space-y-4">
          <p className="text-xs text-muted-foreground">Creates or links an ERP customer. Optionally create a deal on a pipeline.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={convertForm.createDeal} onChange={(e) => setConvertForm({ ...convertForm, createDeal: e.target.checked })} />
            Create deal
          </label>
          {convertForm.createDeal && (
            <>
              <CrmField label="Deal name">
                <input
                  required
                  value={convertForm.dealName}
                  onChange={(e) => setConvertForm({ ...convertForm, dealName: e.target.value })}
                  className={crmInputClass}
                />
              </CrmField>
              <CrmField label="Pipeline">
                <select
                  value={convertForm.pipelineId}
                  onChange={(e) => {
                    const p = pipelines.find((x) => x.id === e.target.value);
                    setConvertForm({ ...convertForm, pipelineId: e.target.value, stageId: p?.stages?.[0]?.id || '' });
                  }}
                  className={crmInputClass}
                >
                  <option value="">Select pipeline</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </CrmField>
              <div className="grid grid-cols-2 gap-4">
                <CrmField label="Stage">
                  <select value={convertForm.stageId} onChange={(e) => setConvertForm({ ...convertForm, stageId: e.target.value })} className={crmInputClass}>
                    <option value="">Select stage</option>
                    {(selectedPipeline?.stages || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </CrmField>
                <CrmField label="Amount">
                  <input
                    type="number"
                    step="0.01"
                    value={convertForm.dealAmount}
                    onChange={(e) => setConvertForm({ ...convertForm, dealAmount: e.target.value })}
                    className={crmInputClass}
                    placeholder="0.00"
                  />
                </CrmField>
              </div>
            </>
          )}
          <CrmModalActions
            onCancel={() => setModal(null)}
            submitLabel="Convert Lead"
            submitting={saving}
            submitIcon={<ArrowRightLeft size={16} />}
          />
        </form>
      </CrmModal>
    </div>
  );
}
