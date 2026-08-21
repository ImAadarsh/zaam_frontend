'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import {
  listCrmPipelines, listCrmDeals, createCrmDeal, moveCrmDeal, listCrmAccounts
} from '@/lib/api';
import { crmApiError, formatMoney } from '@/lib/crm-utils';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  Plus, X, LayoutGrid, List, ArrowRight, AlertCircle, Columns3
} from 'lucide-react';

export default function CrmPipelinePage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [apiMissing, setApiMissing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [moveDeal, setMoveDeal] = useState<any>(null);
  const [moveStageId, setMoveStageId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    stageId: '',
    customerId: '',
    amount: '',
    currency: 'GBP',
    expectedClose: '',
  });
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const orgId = session?.user?.organizationId;
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const stages = useMemo(
    () => [...(pipeline?.stages || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)),
    [pipeline]
  );

  const loadPipelines = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await listCrmPipelines({ organizationId: orgId });
      const list = res.data || [];
      setPipelines(list);
      setApiMissing(false);
      setPipelineId((prev) => prev || list.find((p: any) => p.isDefault)?.id || list[0]?.id || '');
    } catch (err: any) {
      if (err?.response?.status === 404) setApiMissing(true);
      else toast.error(crmApiError(err, 'Failed to load pipelines'));
    }
  }, [orgId]);

  const loadDeals = useCallback(async () => {
    if (!orgId || !pipelineId) {
      setDeals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listCrmDeals({ organizationId: orgId, pipelineId });
      setDeals(res.data || []);
    } catch (err: any) {
      if (err?.response?.status === 404) setApiMissing(true);
      else toast.error(crmApiError(err, 'Failed to load deals'));
    } finally {
      setLoading(false);
    }
  }, [orgId, pipelineId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void loadPipelines();
  }, [hydrated, session?.accessToken, router, loadPipelines]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    if (!showCreate || !orgId) return;
    listCrmAccounts({ organizationId: orgId, limit: 100 })
      .then((r) => setAccounts(r.data || []))
      .catch(() => setAccounts([]));
  }, [showCreate, orgId]);

  function dealsForStage(stageId: string) {
    return deals.filter((d) => String(d.stageId) === String(stageId) || String(d.stage?.id) === String(stageId));
  }

  async function doMove(dealId: string, stageId: string) {
    try {
      const updated = await moveCrmDeal(dealId, { stageId });
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...updated.data, stageId } : d)));
      toast.success('Deal moved');
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to move deal'));
      void loadDeals();
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !pipelineId) return;
    setSaving(true);
    try {
      await createCrmDeal({
        organizationId: orgId,
        name: form.name,
        pipelineId,
        stageId: form.stageId || stages[0]?.id,
        customerId: form.customerId || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        currency: form.currency,
        expectedClose: form.expectedClose || undefined,
        ownerUserId: session?.user?.id,
      });
      toast.success('Deal created');
      setShowCreate(false);
      setForm({ name: '', stageId: '', customerId: '', amount: '', currency: 'GBP', expectedClose: '' });
      void loadDeals();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to create deal'));
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moveDeal || !moveStageId) return;
    setSaving(true);
    try {
      await doMove(moveDeal.id, moveStageId);
      setMoveDeal(null);
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Deal',
      cell: (info) => (
        <Link href={`/crm/deals/${info.row.original.id}`} className="font-semibold text-[#D4A017] hover:underline">
          {info.getValue() as string}
        </Link>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      accessorFn: (r) => r.stage?.name || stages.find((s: any) => String(s.id) === String(r.stageId))?.name || '—',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: (i) => formatMoney(i.getValue() as number, i.row.original.currency),
    },
    {
      id: 'customer',
      header: 'Account',
      accessorFn: (r) => r.customer?.companyName || r.customer?.email || r.customerId || '—',
    },
    {
      accessorKey: 'expectedClose',
      header: 'Close',
      cell: (i) => (i.getValue() ? new Date(i.getValue() as string).toLocaleDateString() : '—'),
    },
    {
      id: 'actions',
      header: '',
      cell: (info) => (
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          onClick={() => {
            setMoveDeal(info.row.original);
            setMoveStageId(info.row.original.stageId || '');
          }}
        >
          <ArrowRight size={16} />
        </button>
      ),
    },
  ], [stages]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header
          title="Pipeline"
          actions={[{ label: 'New Deal', onClick: () => {
            setForm((f) => ({ ...f, stageId: stages[0]?.id || '' }));
            setShowCreate(true);
          }, icon: <Plus size={18} /> }]}
        />
        <main className="p-6 md:p-8 space-y-4">
          {apiMissing && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Pipeline API not ready</div>
                <div className="text-xs mt-0.5 opacity-80">
                  Waiting on <code className="font-mono">/api/crm/pipelines</code> and <code className="font-mono">/api/crm/deals</code>. Configure pipelines in Settings once live.
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pipeline</label>
              <select
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                className="input w-auto min-w-[200px]"
                disabled={!pipelines.length}
              >
                {!pipelines.length && <option value="">No pipelines</option>}
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>
                ))}
              </select>
              <Link href="/crm/settings/pipelines" className="text-xs text-[#D4A017] hover:underline ml-1">Manage</Link>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${view === 'kanban' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              >
                <LayoutGrid size={14} /> Board
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${view === 'list' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              >
                <List size={14} /> List
              </button>
            </div>
          </div>

          {loading ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground italic">Loading deals…</div>
          ) : !pipelineId || !stages.length ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground">
              <Columns3 className="mx-auto mb-3 opacity-40" size={32} />
              <p className="font-medium text-foreground">No pipeline stages</p>
              <p className="text-sm mt-1">Create a pipeline with stages in Settings first.</p>
              <Link href="/crm/settings/pipelines" className="btn btn-primary mt-4 inline-flex">Open settings</Link>
            </div>
          ) : view === 'list' ? (
            deals.length === 0 ? (
              <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground italic">No deals in this pipeline.</div>
            ) : (
              <RichDataTable data={deals} columns={columns} searchPlaceholder="Search deals…" />
            )
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[420px]">
              {stages.map((stage: any) => {
                const columnDeals = dealsForStage(stage.id);
                return (
                  <div
                    key={stage.id}
                    className="w-72 shrink-0 flex flex-col rounded-2xl border border-border/50 bg-muted/20"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dealId = e.dataTransfer.getData('text/deal-id') || dragId;
                      if (dealId) void doMove(dealId, stage.id);
                      setDragId(null);
                    }}
                  >
                    <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{stage.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          {columnDeals.length} · {formatMoney(columnDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0))}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                      {columnDeals.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-8 italic">Drop deals here</div>
                      )}
                      {columnDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => {
                            setDragId(deal.id);
                            e.dataTransfer.setData('text/deal-id', deal.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className="rounded-xl border border-border/60 bg-background p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-[#D4A017]/40 transition"
                        >
                          <Link href={`/crm/deals/${deal.id}`} className="font-medium text-sm hover:text-[#D4A017] block">
                            {deal.name}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-1">{formatMoney(deal.amount, deal.currency)}</div>
                          {(deal.customer?.companyName || deal.customer?.email) && (
                            <div className="text-[11px] text-muted-foreground mt-1 truncate">
                              {deal.customer.companyName || deal.customer.email}
                            </div>
                          )}
                          <button
                            type="button"
                            className="mt-2 text-[11px] text-[#D4A017] hover:underline"
                            onClick={() => {
                              setMoveDeal(deal);
                              setMoveStageId(deal.stageId || stage.id);
                            }}
                          >
                            Move…
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30 sticky top-0">
              <h2 className="text-xl font-bold">New Deal</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Stage</label>
                <select required value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className="input">
                  {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Account (customer)</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="input">
                  <option value="">Optional</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.companyName || a.email || `#${a.id}`}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Close date</label>
                  <input type="date" value={form.expectedClose} onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn flex-1 bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {moveDeal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-lg font-bold">Move {moveDeal.name}</h2>
              <button type="button" onClick={() => setMoveDeal(null)} className="p-2 hover:bg-muted rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={handleMoveSubmit} className="p-5 space-y-4">
              <select required value={moveStageId} onChange={(e) => setMoveStageId(e.target.value)} className="input">
                {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button type="button" onClick={() => setMoveDeal(null)} className="btn flex-1 bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? 'Moving…' : 'Move'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
