'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { useSession } from '@/hooks/use-session';
import { getCrmDeal, updateCrmDeal, moveCrmDeal, listCrmPipelines, createCrmActivity } from '@/lib/api';
import { crmApiError, formatMoney } from '@/lib/crm-utils';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, ArrowRight, PhoneCall } from 'lucide-react';
import { CrmModal, CrmField, CrmModalActions, crmInputClass } from '@/components/crm/crm-modal';

export default function CrmDealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [stageId, setStageId] = useState('');
  const [form, setForm] = useState({ name: '', amount: '', expectedClose: '', status: 'open', probabilityOverride: '' });
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'task' as 'task' | 'call' | 'meeting' | 'note', subject: '', dueAt: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getCrmDeal(id);
      setDeal(res.data);
      setForm({
        name: res.data.name || '',
        amount: res.data.amount != null ? String(res.data.amount) : '',
        expectedClose: res.data.expectedClose ? String(res.data.expectedClose).slice(0, 10) : '',
        status: res.data.status || 'open',
        probabilityOverride: res.data.probabilityOverride != null ? String(res.data.probabilityOverride) : '',
      });
      setStageId(res.data.stageId || res.data.stage?.id || '');
      if (res.data.pipelineId) {
        try {
          const pipes = await listCrmPipelines({ organizationId: session?.user?.organizationId });
          const pipe = (pipes.data || []).find((p: any) => String(p.id) === String(res.data.pipelineId));
          setStages([...(pipe?.stages || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));
        } catch { /* optional */ }
      }
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to load deal'));
      setDeal(null);
    } finally {
      setLoading(false);
    }
  }, [id, session?.user?.organizationId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, session?.accessToken, router, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCrmDeal(id, {
        name: form.name,
        amount: form.amount ? Number(form.amount) : null,
        expectedClose: form.expectedClose || null,
        status: form.status,
        probabilityOverride: form.probabilityOverride !== '' ? Number(form.probabilityOverride) : null,
      });
      toast.success('Deal updated');
      setEditOpen(false);
      void load();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to update deal'));
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await moveCrmDeal(id, { stageId });
      toast.success('Deal moved');
      setMoveOpen(false);
      void load();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to move deal'));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivity(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCrmActivity({
        organizationId: session?.user?.organizationId,
        type: activityForm.type,
        subject: activityForm.subject,
        dueAt: activityForm.dueAt || undefined,
        dealId: id,
        customerId: deal?.customerId,
        ownerUserId: session?.user?.id,
      });
      toast.success('Activity logged');
      setActivityOpen(false);
      setActivityForm({ type: 'task', subject: '', dueAt: '' });
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to create activity'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title={loading ? 'Deal…' : deal?.name || 'Deal'} />
        <main className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/crm/pipeline" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} /> Pipeline
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium">{deal?.name || '…'}</span>
          </div>

          {loading ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground italic">Loading…</div>
          ) : !deal ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center">
              <p className="font-medium">Deal not found</p>
              <Link href="/crm/pipeline" className="text-sm text-[#D4A017] hover:underline mt-2 inline-block">Back to pipeline</Link>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-border/50 p-6 space-y-6">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{deal.name}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {deal.stage?.name || 'Stage'} · {formatMoney(deal.amount, deal.currency)} · {deal.status || 'open'}
                  </p>
                  {deal.customerId && (
                    <Link href={`/crm/accounts/${deal.customerId}`} className="text-sm text-[#D4A017] hover:underline mt-1 inline-block">
                      View account
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setActivityOpen(true)} className="btn bg-muted gap-2 text-sm"><PhoneCall size={16} /> Activity</button>
                  <button type="button" onClick={() => setMoveOpen(true)} className="btn bg-muted gap-2 text-sm"><ArrowRight size={16} /> Move</button>
                  <button type="button" onClick={() => setEditOpen(true)} className="btn btn-primary gap-2 text-sm"><Pencil size={16} /> Edit</button>
                </div>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs uppercase tracking-widest">Expected close</dt>
                  <dd className="mt-1 font-medium">{deal.expectedClose ? new Date(deal.expectedClose).toLocaleDateString() : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs uppercase tracking-widest">Probability</dt>
                  <dd className="mt-1 font-medium">
                    {deal.probability != null ? `${deal.probability}%` : deal.stage?.probability != null ? `${deal.stage.probability}%` : '—'}
                    {deal.probabilitySource && (
                      <span className="text-xs text-muted-foreground font-normal ml-1">({deal.probabilitySource})</span>
                    )}
                  </dd>
                </div>
              </dl>

              {(deal.stageHistory || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Stage history</h3>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {deal.stageHistory.map((h: any) => (
                      <li key={h.id}>{h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'} · {h.note || 'moved'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <CrmModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Deal"
        icon={Pencil}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <CrmField label="Deal Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={crmInputClass}
              placeholder="e.g. Enterprise License Expansion"
            />
          </CrmField>
          <div className="grid grid-cols-2 gap-4">
            <CrmField label="Amount">
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={crmInputClass}
                placeholder="0.00"
              />
            </CrmField>
            <CrmField label="Expected Close">
              <input
                type="date"
                value={form.expectedClose}
                onChange={(e) => setForm({ ...form, expectedClose: e.target.value })}
                className={crmInputClass}
              />
            </CrmField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CrmField label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={crmInputClass}
              >
                <option value="open">Open</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </CrmField>
            <CrmField
              label="Probability Override (%)"
              hint={`Stage default: ${deal?.stage?.probability ?? '—'}%`}
            >
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilityOverride}
                onChange={(e) => setForm({ ...form, probabilityOverride: e.target.value })}
                className={crmInputClass}
                placeholder="Stage default"
              />
            </CrmField>
          </div>
          <CrmModalActions
            onCancel={() => setEditOpen(false)}
            submitLabel="Save Deal"
            submitting={saving}
          />
        </form>
      </CrmModal>

      <CrmModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move Stage"
        icon={ArrowRight}
      >
        <form onSubmit={handleMove} className="space-y-4">
          <CrmField label="Pipeline Stage" hint="Select the new pipeline stage for this deal">
            <select
              required
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className={crmInputClass}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.probability ?? 0}%)
                </option>
              ))}
            </select>
          </CrmField>
          <CrmModalActions
            onCancel={() => setMoveOpen(false)}
            submitLabel="Move Deal"
            submitting={saving}
          />
        </form>
      </CrmModal>

      <CrmModal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title="Log Activity"
        icon={PhoneCall}
      >
        <form onSubmit={handleActivity} className="space-y-4">
          <CrmField label="Activity Type">
            <select
              value={activityForm.type}
              onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
              className={crmInputClass}
            >
              <option value="call">Call</option>
              <option value="task">Task</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </select>
          </CrmField>
          <CrmField label="Subject">
            <input
              required
              value={activityForm.subject}
              onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
              className={crmInputClass}
              placeholder="e.g. Call regarding quotation"
            />
          </CrmField>
          <CrmField label="Scheduled / Due At" hint="Optional schedule or due date for this activity">
            <input
              type="datetime-local"
              value={activityForm.dueAt}
              onChange={(e) => setActivityForm({ ...activityForm, dueAt: e.target.value })}
              className={crmInputClass}
            />
          </CrmField>
          <CrmModalActions
            onCancel={() => setActivityOpen(false)}
            submitLabel="Create Activity"
            submitting={saving}
          />
        </form>
      </CrmModal>
    </div>
  );
}
