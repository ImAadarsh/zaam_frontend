'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  listClassifications,
  createClassification,
  updateClassification,
  deleteClassification,
  backfillClassifications,
  listOrganizations,
  type CatalogClassification,
  type CatalogClassificationType
} from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { useApiAccess } from '@/hooks/use-api-access';
import { FolderTree, Plus, Pencil, Archive, RotateCcw, X, Loader2, Download } from 'lucide-react';

const TABS: { type: CatalogClassificationType; label: string; empty: string }[] = [
  { type: 'category', label: 'Category', empty: 'No categories yet — add one below, or import from existing products.' },
  { type: 'sub_category', label: 'Sub-category', empty: 'No sub-categories yet — add one below. Optionally link each to a parent category.' },
  { type: 'brand', label: 'Brand', empty: 'No brands yet — add brand / manufacturer names for product dropdowns.' },
  { type: 'uom', label: 'UOM', empty: 'No units of measure yet — add values like PCS, BOX, SET…' },
  { type: 'pack_size', label: 'Pack size', empty: 'No pack sizes yet — add values like 1, 12x330ml…' }
];

export default function ClassificationsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']);
  const { can } = useApiAccess();
  const canCreate = can('POST', '/api/catalog/classifications');
  const canUpdate = can('PATCH', '/api/catalog/classifications/:id');
  const canDelete = can('DELETE', '/api/catalog/classifications/:id');
  const canBackfill = can('POST', '/api/catalog/classifications/backfill');

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<CatalogClassificationType>('category');
  const [items, setItems] = useState<CatalogClassification[]>([]);
  const [categories, setCategories] = useState<CatalogClassification[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CatalogClassification | null>(null);
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  const orgId = organizationId || session?.user?.organizationId || '';
  const isSuperAdmin = !!session?.user?.roles?.includes('SUPER_ADMIN');
  const activeTab = TABS.find((t) => t.type === tab)!;

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const status = showArchived ? 'all' : 'active';
      const [listRes, catRes] = await Promise.all([
        listClassifications({ organizationId: orgId, type: tab, status }),
        listClassifications({ organizationId: orgId, type: 'category', status: 'active' })
      ]);
      setItems(listRes.data || []);
      setCategories(catRes.data || []);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        router.replace('/login');
      } else if (e?.response?.status === 403) {
        toast.error('You do not have permission to view classifications.');
      } else {
        toast.error('Failed to load classifications');
      }
    }
  }, [orgId, tab, showArchived, router]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        if (isSuperAdmin) {
          const orgsRes = await listOrganizations();
          setOrganizations(orgsRes.data || []);
        }
        if (session.user.organizationId) {
          setOrganizationId(session.user.organizationId);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId, isSuperAdmin]);

  useEffect(() => {
    if (!hydrated || !hasAccess || !orgId) return;
    load();
  }, [hydrated, hasAccess, orgId, load]);

  const visible = useMemo(() => {
    if (showArchived) return items;
    return items.filter((i) => i.status === 'active');
  }, [items, showArchived]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a name');
      return;
    }
    if (!orgId) {
      toast.error('Organisation required');
      return;
    }
    setSaving(true);
    try {
      await createClassification({
        organizationId: orgId,
        type: tab,
        name: trimmed,
        parentId: tab === 'sub_category' && parentId ? parentId : undefined
      });
      setName('');
      setParentId('');
      toast.success(`${activeTab.label} added`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error('Enter a name');
      return;
    }
    setSaving(true);
    try {
      await updateClassification(editing.id, {
        name: trimmed,
        parentId: editing.type === 'sub_category' ? editParentId || null : undefined
      });
      setEditing(null);
      toast.success('Updated');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function onArchive(row: CatalogClassification) {
    try {
      await deleteClassification(row.id);
      toast.success(`Archived “${row.name}”`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Archive failed');
    }
  }

  async function onRestore(row: CatalogClassification) {
    try {
      await updateClassification(row.id, { status: 'active' });
      toast.success(`Restored “${row.name}”`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Restore failed');
    }
  }

  async function onBackfill() {
    if (!orgId) return;
    setBackfilling(true);
    try {
      const res = await backfillClassifications(orgId);
      const created = Object.values(res.data.created || {}).reduce((a, b) => a + b, 0);
      toast.success(
        created > 0
          ? `Imported ${created} value${created === 1 ? '' : 's'} from existing products`
          : 'No new values — classifications already match your products'
      );
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Import failed');
    } finally {
      setBackfilling(false);
    }
  }

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Catalog · Classifications" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-40 text-muted-foreground">Loading…</div>
          </main>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Catalog · Classifications" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">You do not have permission to manage classifications.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Catalog · Classifications" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <FolderTree className="h-8 w-8" />
                  Manage Classifications
                </h1>
                <p className="text-muted-foreground mt-1 max-w-xl">
                  Organisation lists for Category, Sub-category, Brand, UOM and Pack size. These power dropdowns on Catalog Items and EPOS Add Product.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isSuperAdmin && (
                  <select
                    className="select text-sm"
                    value={orgId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}
                {canBackfill && (
                  <button
                    type="button"
                    onClick={onBackfill}
                    disabled={backfilling}
                    className="btn btn-outline text-sm inline-flex items-center gap-1.5"
                    title="Copy distinct values from this org’s existing catalog items"
                  >
                    {backfilling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Import from products
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-border pb-px">
              {TABS.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => { setTab(t.type); setEditing(null); }}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    tab === t.type
                      ? 'bg-card border border-b-transparent border-border text-foreground -mb-px'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold">{activeTab.label}s</h2>
                <label className="text-xs text-muted-foreground inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived
                </label>
              </div>

              {canCreate && (
                <form onSubmit={onCreate} className="flex flex-wrap items-end gap-2">
                  <label className="text-sm flex-1 min-w-[160px]">
                    Name
                    <input
                      className="mt-1 input w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`New ${activeTab.label.toLowerCase()}`}
                      maxLength={255}
                    />
                  </label>
                  {tab === 'sub_category' && (
                    <label className="text-sm min-w-[160px]">
                      Parent category
                      <select
                        className="mt-1 select w-full"
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                      >
                        <option value="">None</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="submit" disabled={saving} className="btn btn-primary inline-flex items-center gap-1.5">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </form>
              )}

              {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">{activeTab.empty}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    After you add values here, they appear as dropdowns on{' '}
                    <Link href="/catalog/items" className="text-primary hover:underline">Catalog Items</Link>
                    {' '}and EPOS Add Product.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {visible.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-card hover:bg-muted/40">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.type === 'sub_category' && row.parent?.name
                            ? `Under ${row.parent.name}`
                            : null}
                          {row.status === 'archived' && (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Archived</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canUpdate && row.status === 'active' && (
                          <button
                            type="button"
                            className="p-1.5 hover:bg-muted rounded"
                            title="Rename"
                            onClick={() => {
                              setEditing(row);
                              setEditName(row.name);
                              setEditParentId(row.parent?.id || '');
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canUpdate && row.status === 'archived' && (
                          <button
                            type="button"
                            className="p-1.5 hover:bg-muted rounded text-green-700"
                            title="Restore"
                            onClick={() => onRestore(row)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && row.status === 'active' && (
                          <button
                            type="button"
                            className="p-1.5 hover:bg-muted rounded text-amber-700"
                            title="Archive"
                            onClick={() => onArchive(row)}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Rename {activeTab.label}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onUpdate} className="space-y-4">
              <label className="text-sm block">
                Name
                <input
                  className="mt-1 input w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  maxLength={255}
                />
              </label>
              {editing.type === 'sub_category' && (
                <label className="text-sm block">
                  Parent category
                  <select
                    className="mt-1 select w-full"
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
