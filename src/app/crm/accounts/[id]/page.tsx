'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { useSession } from '@/hooks/use-session';
import { getCrmAccount, addCrmAccountNote, createCrmActivity } from '@/lib/api';
import { crmApiError, displayName, formatMoney } from '@/lib/crm-utils';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, MessageSquare, Columns3, PhoneCall,
  StickyNote, ShoppingCart, Plus, X, ExternalLink
} from 'lucide-react';

type Tab = 'overview' | 'contacts' | 'tickets' | 'deals' | 'activities' | 'notes' | 'orders';

export default function CrmAccount360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'task' as 'task' | 'call' | 'meeting' | 'note', subject: '', body: '', dueAt: '' });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getCrmAccount(id, { orderLimit: 20 });
      setPayload(res.data);
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to load account'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    void load();
  }, [hydrated, session?.accessToken, router, load]);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addCrmAccountNote(id, { note: noteText, noteType: 'follow_up' });
      toast.success('Note added');
      setNoteOpen(false);
      setNoteText('');
      void load();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to add note'));
    }
  }

  async function saveActivity(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCrmActivity({
        type: activityForm.type,
        subject: activityForm.subject,
        body: activityForm.body || undefined,
        dueAt: activityForm.dueAt || undefined,
        customerId: id,
        ownerUserId: session?.user?.id,
        organizationId: session?.user?.organizationId,
      });
      toast.success('Activity created');
      setActivityOpen(false);
      setActivityForm({ type: 'task', subject: '', body: '', dueAt: '' });
      void load();
    } catch (err) {
      toast.error(crmApiError(err, 'Failed to create activity'));
    }
  }

  const customer = payload?.customer;
  const title = displayName(customer) || `Customer #${id}`;
  const tickets = payload?.openTickets || [];
  const deals = payload?.deals || [];
  const activities = payload?.activities || [];
  const notes = payload?.notes || [];
  const orders = payload?.recentOrders || [];
  const addresses = payload?.addresses || [];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contacts', label: 'Contacts', count: addresses.length ? 1 : undefined },
    { id: 'tickets', label: 'Tickets', count: tickets.length },
    { id: 'deals', label: 'Deals', count: deals.length },
    { id: 'activities', label: 'Activities', count: activities.length },
    { id: 'notes', label: 'Notes', count: notes.length },
    { id: 'orders', label: 'Orders', count: orders.length },
  ];

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title={loading ? 'Account…' : title} />
        <main className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/crm/accounts" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} /> Accounts
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium">{title}</span>
          </div>

          {loading ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center text-muted-foreground italic">Loading account…</div>
          ) : !payload || !customer ? (
            <div className="glass-panel rounded-2xl border border-border/50 p-12 text-center">
              <Building2 className="mx-auto mb-3 opacity-40" size={32} />
              <p className="font-medium">Account not found</p>
              <Link href="/crm/accounts" className="text-sm text-[#D4A017] hover:underline mt-2 inline-block">Back to accounts</Link>
            </div>
          ) : (
            <>
              <div className="glass-panel rounded-2xl border border-border/50 p-6 flex flex-wrap gap-6 justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Building2 className="text-[#D4A017]" size={22} />
                    {title}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {[customer.email, customer.phone, customer.companyName].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    ERP customer #{id}{' '}
                    <Link href="/orders/customers" className="inline-flex items-center gap-1 text-[#D4A017] hover:underline">
                      Orders module <ExternalLink size={12} />
                    </Link>
                    {payload.portalRetailer && (
                      <span className="ml-2 text-emerald-600">· B2B portal {payload.portalRetailer.status}</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setActivityOpen(true)} className="btn bg-muted gap-2 text-sm">
                    <PhoneCall size={16} /> Log activity
                  </button>
                  <button type="button" onClick={() => setNoteOpen(true)} className="btn bg-muted gap-2 text-sm">
                    <StickyNote size={16} /> Add note
                  </button>
                  <button type="button" onClick={() => router.push('/crm/tickets?new=true')} className="btn btn-primary gap-2 text-sm">
                    <Plus size={16} /> Ticket
                  </button>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto border-b border-border/60 pb-px">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      tab === t.id ? 'border-[#D4A017] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                    {t.count != null && t.count > 0 && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted">{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="glass-panel rounded-2xl border border-border/50 p-6">
                {tab === 'overview' && (
                  <div className="grid gap-6 md:grid-cols-3">
                    <OverviewStat icon={MessageSquare} label="Open tickets" value={tickets.length} />
                    <OverviewStat icon={Columns3} label="Deals" value={deals.length} />
                    <OverviewStat icon={ShoppingCart} label="Recent orders" value={orders.length} />
                    {(payload.tags || []).length > 0 && (
                      <div className="md:col-span-3 flex flex-wrap gap-2">
                        {payload.tags.map((t: any) => (
                          <span key={t.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-border" style={{ borderColor: t.color || undefined }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'contacts' && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-medium">{displayName(customer)}</div>
                      <div className="text-xs text-muted-foreground">{[customer.email, customer.phone].filter(Boolean).join(' · ')}</div>
                      <div className="text-xs text-muted-foreground mt-1">Primary contact (from customer fields)</div>
                    </div>
                    {addresses.map((a: any) => (
                      <div key={a.id} className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                        {[a.addressLine1, a.city, a.postalCode, a.countryCode].filter(Boolean).join(', ')}
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'tickets' && (
                  <EntityList empty="No open tickets." items={tickets} render={(t: any) => (
                    <Link href={`/crm/tickets/${t.id}`} className="block hover:text-[#D4A017]">
                      <div className="font-medium font-mono text-xs">{t.ticketNumber}</div>
                      <div className="text-sm">{t.subject}</div>
                    </Link>
                  )} />
                )}

                {tab === 'deals' && (
                  <EntityList empty="No deals." items={deals} render={(d: any) => (
                    <Link href={`/crm/deals/${d.id}`} className="block hover:text-[#D4A017]">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{formatMoney(d.amount, d.currency)} · {d.status}</div>
                    </Link>
                  )} />
                )}

                {tab === 'activities' && (
                  <EntityList empty="No activities." items={activities} render={(a: any) => (
                    <>
                      <div className="font-medium"><span className="uppercase text-[10px] font-bold text-muted-foreground mr-2">{a.type}</span>{a.subject}</div>
                      <div className="text-xs text-muted-foreground">{a.dueAt ? new Date(a.dueAt).toLocaleString() : '—'}{a.completedAt ? ' · done' : ''}</div>
                    </>
                  )} />
                )}

                {tab === 'notes' && (
                  <EntityList empty="No notes." items={notes} render={(n: any) => (
                    <>
                      <div className="text-sm whitespace-pre-wrap">{n.note}</div>
                      <div className="text-xs text-muted-foreground mt-1">{n.noteType} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                    </>
                  )} />
                )}

                {tab === 'orders' && (
                  <EntityList empty="No recent orders." items={orders} render={(o: any) => (
                    <Link href={`/orders/orders/${o.id}`} className="block hover:text-[#D4A017]">
                      <div className="font-medium font-mono text-xs">{o.orderNumber}</div>
                      <div className="text-sm">{formatMoney(o.total, o.currency)} · {o.status}</div>
                    </Link>
                  )} />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {noteOpen && (
        <Modal title="Add note" onClose={() => setNoteOpen(false)}>
          <form onSubmit={saveNote} className="space-y-4">
            <textarea required value={noteText} onChange={(e) => setNoteText(e.target.value)} className="input min-h-[120px] resize-none" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setNoteOpen(false)} className="btn flex-1 bg-muted">Cancel</button>
              <button type="submit" className="btn btn-primary flex-1">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {activityOpen && (
        <Modal title="Log activity" onClose={() => setActivityOpen(false)}>
          <form onSubmit={saveActivity} className="space-y-4">
            <select value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })} className="input">
              <option value="task">Task</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </select>
            <input required value={activityForm.subject} onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })} className="input" placeholder="Subject" />
            <textarea value={activityForm.body} onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })} className="input min-h-[80px] resize-none" placeholder="Details" />
            <input type="datetime-local" value={activityForm.dueAt} onChange={(e) => setActivityForm({ ...activityForm, dueAt: e.target.value })} className="input" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setActivityOpen(false)} className="btn flex-1 bg-muted">Cancel</button>
              <button type="submit" className="btn btn-primary flex-1">Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function OverviewStat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-[#D4A017]/10 text-[#D4A017]"><Icon size={18} /></div>
      <div>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function EntityList({ items, empty, render }: { items: any[]; empty: string; render: (item: any) => React.ReactNode }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground italic text-center py-8">{empty}</p>;
  return (
    <ul className="divide-y divide-border/50">
      {items.map((item) => <li key={item.id} className="py-3">{render(item)}</li>)}
    </ul>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-full"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
