/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  Calculator,
  ChevronRight,
  FileText,
  KeyRound,
  Mail,
  Plug,
  Receipt,
  ScrollText,
  Share2,
  ShieldCheck,
  Users
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { FileUploadField } from '@/components/file-upload-field';
import { CrmField, CrmModal, CrmModalActions, crmInputClass } from '@/components/crm/crm-modal';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { getOrganization, listBusinessUnits, listOrganizations, updateBusinessUnit, updateOrganization } from '@/lib/api';

type OrgForm = {
  name: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  website: string;
  phone: string;
  email: string;
  logoUrl: string;
};

type LetterheadForm = Omit<OrgForm, 'name'> & { name: string };

const emptyOrg: OrgForm = {
  name: '',
  legalName: '',
  taxId: '',
  registrationNumber: '',
  website: '',
  phone: '',
  email: '',
  logoUrl: ''
};

const LINKS: { href: string; label: string; description: string; icon: React.ReactNode }[] = [
  { href: '/iam/organizations', label: 'Business units & locations', description: 'Divisions, stores, warehouses and their addresses', icon: <Building2 size={18} /> },
  { href: '/catalog/tax-codes', label: 'Tax codes', description: 'VAT / sales tax rates applied to products and invoices', icon: <Receipt size={18} /> },
  { href: '/accounting/settings', label: 'Accounting & VAT', description: 'Currency, VAT scheme, fiscal year, MTD', icon: <Calculator size={18} /> },
  { href: '/marketing/email-connectors', label: 'Email connectors', description: 'SMTP / provider used to send campaigns and emails', icon: <Mail size={18} /> },
  { href: '/crm/integrations', label: 'Integrations & lead webhook', description: 'API keys for Salesforce, Zapier and inbound leads', icon: <Plug size={18} /> },
  { href: '/social/accounts', label: 'Social accounts', description: 'Meta (Facebook / Instagram) connection', icon: <Share2 size={18} /> },
  { href: '/iam/users', label: 'Users', description: 'Invite staff and assign roles', icon: <Users size={18} /> },
  { href: '/iam/roles', label: 'Roles & permissions', description: 'What each role can access', icon: <ShieldCheck size={18} /> },
  { href: '/iam/api-keys', label: 'API keys', description: 'Personal API access keys', icon: <KeyRound size={18} /> },
  { href: '/iam/audit-logs', label: 'Audit logs', description: 'Who changed what, and when', icon: <ScrollText size={18} /> }
];

function toOrgForm(o: any): OrgForm {
  return {
    name: o?.name || '',
    legalName: o?.legalName || '',
    taxId: o?.taxId || '',
    registrationNumber: o?.registrationNumber || '',
    website: o?.website || '',
    phone: o?.phone || '',
    email: o?.email || '',
    logoUrl: o?.logoUrl || ''
  };
}

function apiError(e: any, fallback: string) {
  return e?.response?.data?.error?.message || e?.message || fallback;
}

function LetterheadPreview({ lh, address }: { lh: Partial<OrgForm>; address?: string | null }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white text-slate-900 p-5 flex items-start justify-between gap-4">
      <div className="space-y-0.5 text-xs">
        <div className="text-base font-bold">{lh.name || 'Organisation name'}</div>
        {lh.legalName && lh.legalName !== lh.name && <div>{lh.legalName}</div>}
        {address && <div className="whitespace-pre-line text-slate-600">{address}</div>}
        <div className="text-slate-600">{[lh.phone, lh.email, lh.website].filter(Boolean).join(' · ') || 'No contact details'}</div>
        <div className="text-slate-600">
          {[lh.taxId && `VAT/Tax ID: ${lh.taxId}`, lh.registrationNumber && `Company no: ${lh.registrationNumber}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      {lh.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lh.logoUrl} alt="Logo" className="h-14 max-w-[160px] object-contain" />
      ) : (
        <div className="h-14 w-28 rounded border border-dashed border-slate-300 text-[10px] text-slate-400 flex items-center justify-center">
          No logo
        </div>
      )}
    </div>
  );
}

export default function SystemSettingsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN']);
  const isSuperAdmin = ((session?.user?.roles || []) as any[]).some(
    (r) => String(typeof r === 'string' ? r : r?.code || r?.name || '').toUpperCase() === 'SUPER_ADMIN'
  );

  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgId, setOrgId] = useState('');
  const [org, setOrg] = useState<any>(null);
  const [form, setForm] = useState<OrgForm>(emptyOrg);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [buEditing, setBuEditing] = useState<any>(null);
  const [buForm, setBuForm] = useState<LetterheadForm>(emptyOrg);
  const [buSaving, setBuSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    if (!hasAccess) return;
    const own = session?.user?.organizationId ? String(session.user.organizationId) : '';
    setOrgId(own);
    if (isSuperAdmin) {
      listOrganizations()
        .then((res) => {
          const list = res.data || [];
          setOrgs(list);
          if (!own && list[0]) setOrgId(String(list[0].id));
        })
        .catch(() => undefined);
    }
  }, [hydrated, hasAccess, isSuperAdmin, router, session?.accessToken, session?.user?.organizationId]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [o, bu] = await Promise.all([getOrganization(orgId), listBusinessUnits(orgId).catch(() => ({ data: [] }))]);
      setOrg(o.data);
      setForm(toOrgForm(o.data));
      setUnits(bu.data || []);
    } catch (e: any) {
      toast.error(apiError(e, 'Failed to load organisation'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(toOrgForm(org)), [form, org]);

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Organisation name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await updateOrganization(orgId, {
        name: form.name.trim(),
        legalName: form.legalName.trim(),
        taxId: form.taxId.trim(),
        registrationNumber: form.registrationNumber.trim(),
        website: form.website.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        logoUrl: form.logoUrl
      });
      setOrg(res.data);
      setForm(toOrgForm(res.data));
      toast.success('Organisation profile saved');
    } catch (err: any) {
      toast.error(apiError(err, 'Failed to save organisation'));
    } finally {
      setSaving(false);
    }
  };

  const openBu = (u: any) => {
    const lh = u.settings?.letterhead || {};
    setBuEditing(u);
    setBuForm({
      name: lh.name || '',
      legalName: lh.legalName || '',
      taxId: lh.taxId || '',
      registrationNumber: lh.registrationNumber || '',
      website: lh.website || '',
      phone: lh.phone || '',
      email: lh.email || '',
      logoUrl: lh.logoUrl || ''
    });
  };

  const saveBu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buEditing) return;
    const letterhead = Object.fromEntries(
      Object.entries(buForm)
        .map(([k, v]) => [k, String(v || '').trim()])
        .filter(([, v]) => v)
    );
    const settings = { ...(buEditing.settings || {}) };
    if (Object.keys(letterhead).length) settings.letterhead = letterhead;
    else delete settings.letterhead;
    setBuSaving(true);
    try {
      await updateBusinessUnit(String(buEditing.id), { settings });
      toast.success(`Letterhead saved for ${buEditing.name}`);
      setBuEditing(null);
      load();
    } catch (err: any) {
      toast.error(apiError(err, 'Failed to save letterhead'));
    } finally {
      setBuSaving(false);
    }
  };

  const field = (key: keyof OrgForm, label: string, opts: { type?: string; placeholder?: string; hint?: string } = {}) => (
    <CrmField label={label} hint={opts.hint}>
      <input
        type={opts.type || 'text'}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={opts.placeholder}
        autoComplete="off"
        className={crmInputClass}
      />
    </CrmField>
  );

  const buField = (key: keyof LetterheadForm, label: string, placeholder?: string) => (
    <CrmField label={label}>
      <input
        value={buForm[key]}
        onChange={(e) => setBuForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        autoComplete="off"
        className={crmInputClass}
      />
    </CrmField>
  );

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="Settings" />
        <main className="p-6 md:p-8 space-y-6 max-w-6xl">
          {!hydrated ? null : !hasAccess ? (
            <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Only administrators can change organisation settings.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <p className="text-sm text-muted-foreground">Organisation profile, invoice branding and links to every configuration area.</p>
                </div>
                {isSuperAdmin && orgs.length > 1 && (
                  <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-10 rounded-md border px-3 bg-background text-sm">
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!orgId ? (
                <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Your account is not linked to an organisation.</div>
              ) : loading && !org ? (
                <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground animate-pulse">Loading organisation…</div>
              ) : (
                <div className="grid lg:grid-cols-5 gap-6">
                  <form onSubmit={saveOrg} className="lg:col-span-3 glass-panel rounded-2xl border border-border/50 p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">Organisation profile</h2>
                        <p className="text-xs text-muted-foreground">Used on invoices, quotes, emails and the default letterhead.</p>
                      </div>
                      <button
                        type="submit"
                        disabled={saving || !dirty}
                        className="btn h-10 rounded-xl bg-[#D4A017] hover:bg-[#c49415] text-white border-none disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save profile'}
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {field('name', 'Trading name *')}
                      {field('legalName', 'Legal name')}
                      {field('taxId', 'VAT / Tax ID', { placeholder: 'GB123456789' })}
                      {field('registrationNumber', 'Company number')}
                      {field('email', 'Billing email', { type: 'email', placeholder: 'accounts@company.com' })}
                      {field('phone', 'Phone')}
                      {field('website', 'Website', { placeholder: 'https://company.com', hint: 'Must start with http:// or https://' })}
                    </div>
                    <CrmField label="Logo" hint="PNG, JPG, WEBP or SVG. Shown on invoices and documents.">
                      <FileUploadField
                        value={form.logoUrl ? [form.logoUrl] : []}
                        onChange={(urls) => setForm((f) => ({ ...f, logoUrl: urls[0] || '' }))}
                        folder="organizations"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        maxSizeInMB={2}
                        label="Upload logo"
                      />
                    </CrmField>
                  </form>

                  <div className="lg:col-span-2 glass-panel rounded-2xl border border-border/50 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[#D4A017]" />
                      <h2 className="font-semibold">Invoice letterhead</h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Default letterhead (from the profile{dirty ? ', unsaved changes shown' : ''}). Business units can override it; the invoice page lets you pick one.
                    </p>
                    <LetterheadPreview lh={form} />
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Business unit letterheads</div>
                      {units.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No business units yet.{' '}
                          <Link href="/iam/organizations" className="text-primary hover:underline">
                            Create one
                          </Link>{' '}
                          to use a separate letterhead per division.
                        </p>
                      ) : (
                        units.map((u) => (
                          <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{u.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {u.settings?.letterhead && Object.keys(u.settings.letterhead).length ? 'Custom letterhead' : 'Uses organisation letterhead'}
                              </div>
                            </div>
                            <button type="button" onClick={() => openBu(u)} className="text-xs font-medium text-primary hover:underline shrink-0">
                              Edit letterhead
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              <section className="space-y-3">
                <h2 className="font-semibold">Configuration</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 hover:border-[#D4A017]/50 transition"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4A017]/15 text-[#D4A017]">{l.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-sm">{l.label}</span>
                        <span className="block text-xs text-muted-foreground">{l.description}</span>
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground mt-1" />
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <CrmModal open={!!buEditing} onClose={() => setBuEditing(null)} title={`Letterhead · ${buEditing?.name || ''}`} icon={FileText} wide>
        <form onSubmit={saveBu} className="space-y-4">
          <p className="text-xs text-muted-foreground">Leave a field empty to use the organisation value.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {buField('name', 'Name on invoice', form.name)}
            {buField('legalName', 'Legal name', form.legalName)}
            {buField('taxId', 'VAT / Tax ID', form.taxId)}
            {buField('registrationNumber', 'Company number', form.registrationNumber)}
            {buField('email', 'Email', form.email)}
            {buField('phone', 'Phone', form.phone)}
            {buField('website', 'Website', form.website)}
          </div>
          <CrmField label="Logo">
            <FileUploadField
              value={buForm.logoUrl ? [buForm.logoUrl] : []}
              onChange={(urls) => setBuForm((f) => ({ ...f, logoUrl: urls[0] || '' }))}
              folder="organizations"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              maxSizeInMB={2}
              label="Upload logo"
            />
          </CrmField>
          <LetterheadPreview
            lh={Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (buForm as any)[k] || v]))}
          />
          <CrmModalActions onCancel={() => setBuEditing(null)} submitLabel="Save letterhead" submitting={buSaving} />
        </form>
      </CrmModal>
    </div>
  );
}
