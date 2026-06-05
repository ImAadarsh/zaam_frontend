'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import {
  listChannelConnections,
  createWordPressConnection,
  testChannelConnection,
  deleteChannelConnection,
  browseWordPressProducts,
  importWordPressProducts,
  exportToWordPress,
  previewWordPressExport,
  listOrganizations,
  getOrganization,
  listWarehouses,
  listPriceLists,
  listBusinessUnits,
  listProductImportJobs,
  type WordPressAuthMode
} from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import {
  Globe,
  Plus,
  Trash2,
  Zap,
  Loader2,
  Package2,
  Download,
  Upload,
  Search,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowUpFromLine,
  ArrowDownToLine
} from 'lucide-react';

type WpConnection = {
  id: string;
  name: string;
  storeUrl: string;
  keyHint: string | null;
  status: 'active' | 'inactive';
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
};

type WpProduct = {
  id: number;
  name: string;
  sku: string;
  type: string;
  status: string;
  regular_price: string;
  stock_quantity: number | null;
  categories: Array<{ name: string }>;
  images: Array<{ src: string }>;
};

type ErpItem = { id: string; sku: string; name: string; status: string; category: string };

type ActiveTab = 'connections' | 'browse' | 'import' | 'export';

function Badge({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) return <span className="text-xs text-muted-foreground">{label}</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'}`}>
      {label}
    </span>
  );
}

export default function WordPressChannelsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN']);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('connections');

  // ── Connections ──────────────────────────────────────────────────────────
  const [connections, setConnections] = useState<WpConnection[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [newConn, setNewConn] = useState({
    name: '',
    storeUrl: '',
    authMode: 'appPassword' as WordPressAuthMode,
    username: '',
    appPassword: '',
    consumerKey: '',
    consumerSecret: ''
  });
  const [savingConn, setSavingConn] = useState(false);
  const [selectedConnId, setSelectedConnId] = useState('');

  // ── Browse ────────────────────────────────────────────────────────────────
  const [wpProducts, setWpProducts] = useState<WpProduct[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  // ── Import ────────────────────────────────────────────────────────────────
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [importOrgId, setImportOrgId] = useState('');
  const [importWarehouseId, setImportWarehouseId] = useState('');
  const [importPriceListId, setImportPriceListId] = useState('');
  const [importBuId, setImportBuId] = useState('');
  const [importDupMode, setImportDupMode] = useState<'skip' | 'update'>('skip');
  const [importAll, setImportAll] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);
  const [importElapsed, setImportElapsed] = useState(0);
  const [importPhase, setImportPhase] = useState('');
  const importTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Export ────────────────────────────────────────────────────────────────
  const [exportOrgId, setExportOrgId] = useState('');
  const [exportItems, setExportItems] = useState<ErpItem[]>([]);
  const [loadingExportItems, setLoadingExportItems] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set());
  const [exportAll, setExportAll] = useState(false);
  const [exportDupMode, setExportDupMode] = useState<'skip' | 'update'>('skip');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any | null>(null);
  const [exportElapsed, setExportElapsed] = useState(0);
  const exportTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<any[]>([]);

  const orgId = session?.user?.organizationId ?? '';

  const loadConnections = useCallback(async () => {
    const wpRes = await listChannelConnections(orgId ? { organizationId: orgId } : undefined)
      .catch(() => null);
    const all = (wpRes?.data ?? []).filter((c: any) => c.channel === 'wordpress');
    setConnections(all);
    if (all.length > 0 && !selectedConnId) setSelectedConnId(all[0].id);
  }, [orgId, selectedConnId]);

  const loadPageData = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);

    const [orgsRes, whRes, jobsRes] = await Promise.allSettled([
      listOrganizations().catch(() => null),
      listWarehouses({ limit: 200 }).catch(() => null),
      listProductImportJobs({ organizationId: orgId, limit: 20 }).catch(() => null)
    ]);

    if (orgsRes.status === 'fulfilled' && orgsRes.value?.data?.length) {
      setOrganizations(orgsRes.value.data);
    } else if (orgId) {
      const single = await getOrganization(orgId).catch(() => null);
      if (single?.data) setOrganizations([single.data]);
    }
    if (whRes.status === 'fulfilled' && whRes.value?.data) setWarehouses(whRes.value.data);
    if (jobsRes.status === 'fulfilled' && jobsRes.value?.data) setJobs(jobsRes.value.data);

    const effectiveOrg = orgId || (orgsRes.status === 'fulfilled' && orgsRes.value?.data?.[0]?.id) || '';
    if (effectiveOrg) {
      setImportOrgId(effectiveOrg);
      setExportOrgId(effectiveOrg);
      const [buRes, plRes] = await Promise.allSettled([
        listBusinessUnits(orgId),
        listPriceLists({ organizationId: orgId })
      ]);
      if (buRes.status === 'fulfilled') setBusinessUnits(buRes.value.data || []);
      if (plRes.status === 'fulfilled') setPriceLists(plRes.value.data || []);
    }

    await loadConnections();
    setLoading(false);
  }, [session, orgId, loadConnections]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) { router.replace('/login'); return; }
    loadPageData();
    return () => {
      if (importTimerRef.current) clearInterval(importTimerRef.current);
      if (exportTimerRef.current) clearInterval(exportTimerRef.current);
    };
  }, [hydrated, hasAccess, session, router, loadPageData]);

  // ── Connection handlers ───────────────────────────────────────────────────
  async function handleSaveConnection(e: React.FormEvent) {
    e.preventDefault();
    const effectiveOrgId = orgId || organizations[0]?.id;
    if (!effectiveOrgId) {
      toast.error('No organization found — make sure you are logged in with a valid account');
      return;
    }
    setSavingConn(true);
    try {
      const payload: any = {
        organizationId: effectiveOrgId,
        name: newConn.name,
        storeUrl: newConn.storeUrl,
        authMode: newConn.authMode
      };
      if (newConn.authMode === 'appPassword') {
        payload.username = newConn.username;
        payload.appPassword = newConn.appPassword;
      } else {
        payload.consumerKey = newConn.consumerKey;
        payload.consumerSecret = newConn.consumerSecret;
      }
      const res = await createWordPressConnection(payload);
      setConnections((prev) => [...prev, res.data]);
      setSelectedConnId(res.data.id);
      setShowAddForm(false);
      setNewConn({ name: '', storeUrl: '', authMode: 'appPassword', username: '', appPassword: '', consumerKey: '', consumerSecret: '' });
      toast.success(`WordPress connection "${res.data.name}" saved`);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to save connection';
      toast.error(msg);
      console.error('WordPress connection error:', e?.response?.data ?? e);
    } finally {
      setSavingConn(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await testChannelConnection(id);
      toast.success(res.data.message);
      setConnections((prev) => prev.map((c) =>
        c.id === id ? { ...c, lastTestOk: true, lastTestMessage: res.data.message, lastTestedAt: new Date().toISOString() } : c
      ));
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Test failed');
      setConnections((prev) => prev.map((c) =>
        c.id === id ? { ...c, lastTestOk: false, lastTestMessage: e?.response?.data?.error?.message || 'Failed' } : c
      ));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDeleteConn(id: string, name: string) {
    if (!confirm(`Delete connection "${name}"?`)) return;
    await deleteChannelConnection(id);
    setConnections((prev) => prev.filter((c) => c.id !== id));
    if (selectedConnId === id) setSelectedConnId(connections.find((c) => c.id !== id)?.id ?? '');
    toast.success('Connection deleted');
  }

  // ── Browse handlers ───────────────────────────────────────────────────────
  async function handleBrowse(page = 1) {
    if (!selectedConnId) { toast.error('Select a WordPress connection first'); return; }
    setBrowsing(true);
    setBrowsePage(page);
    setSelectedProductIds(new Set());
    try {
      const res = await browseWordPressProducts({
        connectionId: selectedConnId,
        organizationId: orgId,
        page,
        perPage: 30,
        search: browseSearch || undefined
      });
      setWpProducts(res.data);
      setBrowseTotal(res.pagination.total);
      setBrowseTotalPages(res.pagination.totalPages);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to fetch products');
    } finally {
      setBrowsing(false);
    }
  }

  function toggleProduct(id: number) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedProductIds.size === wpProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(wpProducts.map((p) => p.id)));
    }
  }

  // ── Import handlers ───────────────────────────────────────────────────────
  function startTimer(
    setElapsed: (n: number) => void,
    timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
  ) {
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }

  function stopTimer(
    timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
  ) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleImport() {
    if (!selectedConnId) { toast.error('Select a connection'); return; }
    if (!importOrgId) { toast.error('Select an organization'); return; }
    const usingSelected = !importAll && selectedProductIds.size > 0;

    setImporting(true);
    setImportResult(null);
    setImportElapsed(0);
    startTimer(setImportElapsed, importTimerRef);
    setImportPhase('Connecting to WordPress store…');

    try {
      setTimeout(() => setImportPhase('Fetching products from WordPress API…'), 2000);
      setTimeout(() => setImportPhase('Processing product data and variants…'), 8000);
      setTimeout(() => setImportPhase('Saving to ERP catalog…'), 15000);

      const res = await importWordPressProducts({
        connectionId: selectedConnId,
        organizationId: importOrgId,
        productIds: usingSelected ? Array.from(selectedProductIds) : undefined,
        importAll: importAll || !usingSelected,
        options: {
          businessUnitId: importBuId || undefined,
          warehouseId: importWarehouseId || undefined,
          priceListId: importPriceListId || undefined,
          duplicateMode: importDupMode,
          importProducts: true,
          importVariants: true,
          importInventory: !!importWarehouseId,
          importPrices: !!importPriceListId,
          importMedia: true,
          importChannelMappings: true
        }
      });
      setImportPhase('Done!');
      setImportResult(res.data.summary);
      toast.success('Import completed');
      const jobsRes = await listProductImportJobs({ organizationId: importOrgId, limit: 20 }).catch(() => null);
      if (jobsRes?.data) setJobs(jobsRes.data);
    } catch (e: any) {
      setImportPhase('');
      toast.error(e?.response?.data?.error?.message || 'Import failed');
    } finally {
      stopTimer(importTimerRef);
      setImporting(false);
    }
  }

  // ── Export handlers ───────────────────────────────────────────────────────
  async function loadExportItems() {
    if (!exportOrgId) return;
    setLoadingExportItems(true);
    try {
      const res = await previewWordPressExport({
        connectionId: selectedConnId,
        organizationId: exportOrgId
      });
      setExportItems(res.data.items);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load ERP catalog');
    } finally {
      setLoadingExportItems(false);
    }
  }

  async function handleExport() {
    if (!selectedConnId) { toast.error('Select a connection'); return; }
    if (!exportOrgId) { toast.error('Select an organization'); return; }
    if (!exportAll && selectedExportIds.size === 0) { toast.error('Select products to export or enable "Export all"'); return; }

    setExporting(true);
    setExportResult(null);
    setExportElapsed(0);
    startTimer(setExportElapsed, exportTimerRef);

    try {
      const res = await exportToWordPress({
        connectionId: selectedConnId,
        organizationId: exportOrgId,
        catalogItemIds: exportAll ? undefined : Array.from(selectedExportIds),
        exportAll,
        duplicateMode: exportDupMode
      });
      setExportResult(res.data);
      toast.success(`Export complete — ${res.data.created} created, ${res.data.updated} updated`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Export failed');
    } finally {
      stopTimer(exportTimerRef);
      setExporting(false);
    }
  }

  if (!hydrated || !hasAccess) return null;

  const activeConn = connections.find((c) => c.id === selectedConnId);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="Catalog · WordPress Channels" />
        <main className="flex-1 overflow-auto p-4 md:p-6 max-w-5xl">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4A017]" />
            </div>
          ) : (
            <>
              {/* Description */}
              <p className="text-muted-foreground text-sm mb-6">
                Connect to WordPress / WooCommerce stores to browse all products, import them into the ERP catalog, and push ERP products back to WordPress.
              </p>

              {/* Tab bar */}
              <div className="flex gap-1 mb-6 border-b border-border">
                {([
                  { id: 'connections', label: 'Connections', icon: Globe },
                  { id: 'browse', label: 'Browse Products', icon: Search },
                  { id: 'import', label: 'Import', icon: ArrowDownToLine },
                  { id: 'export', label: 'Export', icon: ArrowUpFromLine }
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === id
                        ? 'border-[#D4A017] text-[#D4A017]'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>

              {/* ── CONNECTIONS TAB ─────────────────────────────────────── */}
              {activeTab === 'connections' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">WordPress / WooCommerce connections</h2>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      <Plus size={14} /> Add connection
                    </button>
                  </div>

                  {showAddForm && (
                    <form onSubmit={handleSaveConnection} className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
                      <h3 className="font-semibold text-sm">New WordPress connection</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium sm:col-span-2">
                          Connection name
                          <input required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            placeholder="e.g. My Store" value={newConn.name}
                            onChange={(e) => setNewConn({ ...newConn, name: e.target.value })} />
                        </label>
                        <label className="block text-sm font-medium sm:col-span-2">
                          WordPress site URL
                          <input required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            placeholder="https://yourstore.com" value={newConn.storeUrl}
                            onChange={(e) => setNewConn({ ...newConn, storeUrl: e.target.value })} />
                        </label>
                        <label className="block text-sm font-medium sm:col-span-2">
                          Authentication method
                          <select className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            value={newConn.authMode}
                            onChange={(e) => setNewConn({ ...newConn, authMode: e.target.value as WordPressAuthMode })}>
                            <option value="appPassword">WordPress Application Password (username + app password)</option>
                            <option value="consumerKey">WooCommerce Consumer Key / Secret</option>
                          </select>
                        </label>

                        {newConn.authMode === 'appPassword' ? (
                          <>
                            <label className="block text-sm font-medium">
                              WordPress username
                              <input required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                placeholder="nicefind" value={newConn.username}
                                onChange={(e) => setNewConn({ ...newConn, username: e.target.value })} />
                            </label>
                            <label className="block text-sm font-medium">
                              Application password
                              <input required type="password" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-xs"
                                placeholder="xxxx xxxx xxxx xxxx" value={newConn.appPassword}
                                onChange={(e) => setNewConn({ ...newConn, appPassword: e.target.value })} />
                              <p className="mt-1 text-xs text-muted-foreground">
                                WP Admin → Users → Profile → Application Passwords
                              </p>
                            </label>
                          </>
                        ) : (
                          <>
                            <label className="block text-sm font-medium">
                              Consumer key
                              <input required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-xs"
                                placeholder="ck_..." value={newConn.consumerKey}
                                onChange={(e) => setNewConn({ ...newConn, consumerKey: e.target.value })} />
                            </label>
                            <label className="block text-sm font-medium">
                              Consumer secret
                              <input required type="password" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-xs"
                                placeholder="cs_..." value={newConn.consumerSecret}
                                onChange={(e) => setNewConn({ ...newConn, consumerSecret: e.target.value })} />
                              <p className="mt-1 text-xs text-muted-foreground">
                                WooCommerce → Settings → Advanced → REST API
                              </p>
                            </label>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={savingConn}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                          {savingConn ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          Save connection
                        </button>
                        <button type="button" onClick={() => setShowAddForm(false)}
                          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {connections.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                      <Globe className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">No WordPress connections yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">Click "Add connection" to link your WordPress / WooCommerce store.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                      {connections.map((c) => (
                        <li key={c.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm bg-background/30 ${selectedConnId === c.id ? 'bg-[#D4A017]/5 border-l-2 border-l-[#D4A017]' : ''}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{c.name}</span>
                              <Badge label={c.lastTestOk ? 'Connected' : c.lastTestOk === false ? 'Error' : 'Untested'} ok={c.lastTestOk} />
                            </div>
                            <span className="text-muted-foreground text-xs truncate block">{c.storeUrl}</span>
                            {c.keyHint && <span className="text-xs text-muted-foreground font-mono">{c.keyHint}</span>}
                            {c.lastTestMessage && (
                              <span className={`text-xs block mt-0.5 ${c.lastTestOk ? 'text-green-600' : 'text-red-500'}`}>
                                {c.lastTestMessage}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button"
                              onClick={() => { setSelectedConnId(c.id); setActiveTab('browse'); }}
                              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted">
                              <Search size={12} /> Browse
                            </button>
                            <button type="button"
                              onClick={() => handleTest(c.id)}
                              disabled={testingId === c.id}
                              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                              {testingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                              Test
                            </button>
                            <button type="button"
                              onClick={() => handleDeleteConn(c.id, c.name)}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Recent jobs */}
                  {jobs.filter((j) => j.channel === 'wordpress').length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold text-sm mb-3">Recent WordPress import jobs</h3>
                      <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                        {jobs.filter((j) => j.channel === 'wordpress').slice(0, 5).map((j) => (
                          <li key={j.id} className="flex justify-between items-center px-4 py-3 text-sm bg-background/30">
                            <span>
                              <span className="font-medium">{j.fileName || j.sourceType}</span>
                              {j.summary?.productCount != null && (
                                <span className="text-muted-foreground"> · {j.summary.productCount} products</span>
                              )}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                              j.status === 'completed' ? 'bg-green-500/15 text-green-600'
                              : j.status === 'failed' ? 'bg-red-500/15 text-red-600'
                              : 'bg-amber-500/15 text-amber-600'
                            }`}>
                              {j.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* ── BROWSE TAB ─────────────────────────────────────────── */}
              {activeTab === 'browse' && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={selectedConnId}
                      onChange={(e) => { setSelectedConnId(e.target.value); setWpProducts([]); }}
                    >
                      <option value="">Select connection…</option>
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
                        placeholder="Search products…"
                        value={browseSearch}
                        onChange={(e) => setBrowseSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBrowse(1)}
                      />
                    </div>
                    <button type="button" onClick={() => handleBrowse(1)} disabled={browsing || !selectedConnId}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                      {browsing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                      Load products
                    </button>
                  </div>

                  {wpProducts.length > 0 && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{browseTotal} products total</span>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={toggleSelectAll}
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                            {selectedProductIds.size === wpProducts.length
                              ? <CheckSquare size={16} className="text-[#D4A017]" />
                              : <Square size={16} />}
                            {selectedProductIds.size > 0 ? `${selectedProductIds.size} selected` : 'Select all on page'}
                          </button>
                          {selectedProductIds.size > 0 && (
                            <button type="button"
                              onClick={() => { setActiveTab('import'); setImportAll(false); }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A017] px-3 py-1.5 text-sm font-medium text-black">
                              <ArrowDownToLine size={14} />
                              Import {selectedProductIds.size} selected
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                              <th className="w-8 px-3 py-3"></th>
                              <th className="w-12 px-3 py-3"></th>
                              <th className="px-3 py-3 text-left font-medium">Name</th>
                              <th className="px-3 py-3 text-left font-medium">SKU</th>
                              <th className="px-3 py-3 text-left font-medium">Type</th>
                              <th className="px-3 py-3 text-left font-medium">Price</th>
                              <th className="px-3 py-3 text-left font-medium">Stock</th>
                              <th className="px-3 py-3 text-left font-medium">Category</th>
                              <th className="px-3 py-3 text-left font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {wpProducts.map((p) => (
                              <tr key={p.id} onClick={() => toggleProduct(p.id)}
                                className={`cursor-pointer hover:bg-muted/30 ${selectedProductIds.has(p.id) ? 'bg-[#D4A017]/5' : ''}`}>
                                <td className="px-3 py-3">
                                  {selectedProductIds.has(p.id)
                                    ? <CheckSquare size={16} className="text-[#D4A017]" />
                                    : <Square size={16} className="text-muted-foreground" />}
                                </td>
                                <td className="px-3 py-2">
                                  {p.images?.[0]?.src
                                    ? <img src={p.images[0].src} alt="" className="h-9 w-9 rounded object-cover border border-border" />
                                    : <div className="h-9 w-9 rounded border border-border bg-muted flex items-center justify-center"><Package2 size={14} className="text-muted-foreground" /></div>
                                  }
                                </td>
                                <td className="px-3 py-3 font-medium max-w-[200px] truncate">{p.name}</td>
                                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.sku || '—'}</td>
                                <td className="px-3 py-3 text-muted-foreground capitalize">{p.type}</td>
                                <td className="px-3 py-3">{p.regular_price ? `£${p.regular_price}` : '—'}</td>
                                <td className="px-3 py-3">{p.stock_quantity ?? '—'}</td>
                                <td className="px-3 py-3 text-muted-foreground">{p.categories?.[0]?.name ?? '—'}</td>
                                <td className="px-3 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                    p.status === 'publish' ? 'bg-green-500/15 text-green-600' : 'bg-amber-500/15 text-amber-600'
                                  }`}>{p.status === 'publish' ? 'Published' : p.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Page {browsePage} of {browseTotalPages}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleBrowse(browsePage - 1)} disabled={browsePage <= 1 || browsing}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                            <ChevronLeft size={14} /> Previous
                          </button>
                          <button type="button" onClick={() => handleBrowse(browsePage + 1)} disabled={browsePage >= browseTotalPages || browsing}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                            Next <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {!browsing && wpProducts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                      <Package2 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">Select a connection and click "Load products" to browse your WordPress store.</p>
                    </div>
                  )}
                </section>
              )}

              {/* ── IMPORT TAB ─────────────────────────────────────────── */}
              {activeTab === 'import' && (
                <section className="space-y-5">
                  <h2 className="text-lg font-semibold">Import from WordPress</h2>
                  <p className="text-sm text-muted-foreground">Pull products from your WordPress/WooCommerce store into the ERP catalog.</p>

                  <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium">
                        Connection <span className="text-red-400">*</span>
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={selectedConnId} onChange={(e) => setSelectedConnId(e.target.value)}>
                          <option value="">Select connection…</option>
                          {connections.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.storeUrl}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Organization <span className="text-red-400">*</span>
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={importOrgId} onChange={(e) => setImportOrgId(e.target.value)}>
                          <option value="">Select organization…</option>
                          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Business unit
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={importBuId} onChange={(e) => setImportBuId(e.target.value)}>
                          <option value="">None</option>
                          {businessUnits.map((bu) => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Warehouse
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={importWarehouseId} onChange={(e) => setImportWarehouseId(e.target.value)}>
                          <option value="">None (skip inventory)</option>
                          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Price list
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={importPriceListId} onChange={(e) => setImportPriceListId(e.target.value)}>
                          <option value="">None (skip prices)</option>
                          {priceLists.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        If product exists
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={importDupMode} onChange={(e) => setImportDupMode(e.target.value as 'skip' | 'update')}>
                          <option value="skip">Skip duplicates</option>
                          <option value="update">Update existing</option>
                        </select>
                      </label>
                    </div>

                    {/* Import scope */}
                    <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
                      <p className="text-sm font-medium">Import scope</p>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" checked={importAll} onChange={() => setImportAll(true)} className="text-[#D4A017]" />
                        Import all products from WordPress store
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" checked={!importAll} onChange={() => setImportAll(false)} className="text-[#D4A017]" />
                        Import only selected products ({selectedProductIds.size} selected from Browse tab)
                      </label>
                      {!importAll && selectedProductIds.size === 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle size={12} /> Go to Browse tab, load products, and select them first.
                        </p>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={handleImport} disabled={importing || !selectedConnId || !importOrgId}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
                    {importing ? <Loader2 size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
                    {importing ? 'Importing…' : importAll ? 'Import all products' : `Import ${selectedProductIds.size} products`}
                  </button>

                  {importing && (
                    <div className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/5 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#D4A017] font-medium text-sm">
                          <Loader2 size={16} className="animate-spin" />
                          {importPhase}
                        </div>
                        <span className="font-mono text-lg font-bold text-[#D4A017] tabular-nums">
                          {String(Math.floor(importElapsed / 60)).padStart(2, '0')}:{String(importElapsed % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-[#D4A017] rounded-full animate-pulse" style={{ width: `${Math.min(90, (importElapsed / 60) * 100)}%` }} />
                      </div>
                      {importElapsed >= 30 && importElapsed < 120 && (
                        <p className="text-xs text-[#D4A017]/70">
                          Still running — fetching variations or saving to DB. Please wait…
                        </p>
                      )}
                      {importElapsed >= 120 && (
                        <p className="text-xs text-amber-500 flex items-center gap-1">
                          <AlertTriangle size={12} /> Taking longer than usual — the WordPress site may be slow. Do not close this page.
                        </p>
                      )}
                    </div>
                  )}

                  {importResult && (
                    <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5 space-y-4">
                      <h3 className="font-semibold text-green-600 flex items-center gap-2">
                        <CheckCircle2 size={18} /> Import complete
                      </h3>
                      {/* Created row */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Created</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            ['Products', (importResult as any).productsCreated ?? 0],
                            ['Variants', (importResult as any).variantsCreated ?? 0],
                            ['Stock lines', (importResult as any).stockItemsCreated ?? 0],
                            ['Images', (importResult as any).mediaCreated ?? 0]
                          ].map(([label, value]) => (
                            <div key={`c-${label}`} className="rounded-lg border border-border bg-background/50 p-3 text-center">
                              <div className="text-xl font-bold tabular-nums text-[#D4A017]">{value as number}</div>
                              <div className="text-xs text-muted-foreground mt-1">{label as string}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Updated row — only show if any updates happened */}
                      {((importResult as any).productsUpdated > 0 || (importResult as any).variantsUpdated > 0) && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Updated</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              ['Products', (importResult as any).productsUpdated ?? 0],
                              ['Variants', (importResult as any).variantsUpdated ?? 0],
                              ['Channel links', (importResult as any).channelMappingsCreated ?? 0],
                              ['Skipped', (importResult as any).productsSkipped ?? 0]
                            ].map(([label, value]) => (
                              <div key={`u-${label}`} className="rounded-lg border border-border bg-background/50 p-3 text-center">
                                <div className="text-xl font-bold tabular-nums text-blue-500">{value as number}</div>
                                <div className="text-xs text-muted-foreground mt-1">{label as string}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Skipped-only row when nothing was created or updated */}
                      {((importResult as any).productsUpdated === 0 && (importResult as any).productsCreated === 0 && (importResult as any).productsSkipped > 0) && (
                        <p className="text-sm text-muted-foreground">
                          {(importResult as any).productsSkipped} product(s) already exist — switch to <strong>Update existing</strong> to refresh their data.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* ── EXPORT TAB ─────────────────────────────────────────── */}
              {activeTab === 'export' && (
                <section className="space-y-5">
                  <h2 className="text-lg font-semibold">Export to WordPress</h2>
                  <p className="text-sm text-muted-foreground">Push ERP catalog products to your WordPress/WooCommerce store as new products or update existing ones.</p>

                  <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium">
                        Connection <span className="text-red-400">*</span>
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={selectedConnId} onChange={(e) => setSelectedConnId(e.target.value)}>
                          <option value="">Select connection…</option>
                          {connections.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.storeUrl}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Organization <span className="text-red-400">*</span>
                        <select className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={exportOrgId} onChange={(e) => { setExportOrgId(e.target.value); setExportItems([]); }}>
                          <option value="">Select organization…</option>
                          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium sm:col-span-2">
                        If product already exists in WordPress
                        <select className="mt-1.5 w-full max-w-md rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                          value={exportDupMode} onChange={(e) => setExportDupMode(e.target.value as 'skip' | 'update')}>
                          <option value="skip">Skip — don't overwrite existing</option>
                          <option value="update">Update — overwrite with ERP data</option>
                        </select>
                      </label>
                    </div>

                    {/* Scope */}
                    <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
                      <p className="text-sm font-medium">Export scope</p>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={exportAll} onChange={(e) => setExportAll(e.target.checked)} className="text-[#D4A017]" />
                        Export entire ERP catalog (all products)
                      </label>
                      {!exportAll && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={loadExportItems} disabled={!exportOrgId || loadingExportItems}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                              {loadingExportItems ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                              Load ERP catalog
                            </button>
                            {exportItems.length > 0 && (
                              <span className="text-xs text-muted-foreground">{exportItems.length} products available</span>
                            )}
                          </div>
                          {exportItems.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <button type="button" onClick={() => setSelectedExportIds(new Set(exportItems.map((i) => i.id)))}
                                  className="text-[#D4A017] hover:underline text-xs">Select all</button>
                                <button type="button" onClick={() => setSelectedExportIds(new Set())}
                                  className="text-muted-foreground hover:underline text-xs">Clear</button>
                                <span className="text-muted-foreground text-xs">{selectedExportIds.size} selected</span>
                              </div>
                              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                                {exportItems.map((item) => (
                                  <label key={item.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-muted/30 ${selectedExportIds.has(item.id) ? 'bg-[#D4A017]/5' : ''}`}>
                                    <input type="checkbox" checked={selectedExportIds.has(item.id)}
                                      onChange={(e) => {
                                        const next = new Set(selectedExportIds);
                                        e.target.checked ? next.add(item.id) : next.delete(item.id);
                                        setSelectedExportIds(next);
                                      }}
                                      className="text-[#D4A017]" />
                                    <span className="font-mono text-xs text-muted-foreground w-24 truncate shrink-0">{item.sku}</span>
                                    <span className="font-medium truncate">{item.name}</span>
                                    <span className="text-xs text-muted-foreground ml-auto shrink-0 capitalize">{item.status}</span>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={handleExport}
                    disabled={exporting || !selectedConnId || !exportOrgId || (!exportAll && selectedExportIds.size === 0)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
                    {exporting ? <Loader2 size={18} className="animate-spin" /> : <ArrowUpFromLine size={18} />}
                    {exporting ? 'Exporting…' : exportAll ? 'Export all to WordPress' : `Export ${selectedExportIds.size} products`}
                  </button>

                  {exporting && (
                    <div className="rounded-2xl border border-[#D4A017]/30 bg-[#D4A017]/5 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#D4A017] font-medium text-sm">
                          <Loader2 size={16} className="animate-spin" />
                          Pushing products to WordPress…
                        </div>
                        <span className="font-mono text-lg font-bold text-[#D4A017] tabular-nums">
                          {String(Math.floor(exportElapsed / 60)).padStart(2, '0')}:{String(exportElapsed % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-[#D4A017] rounded-full animate-pulse" style={{ width: `${Math.min(90, (exportElapsed / 30) * 100)}%` }} />
                      </div>
                      {exportElapsed >= 20 && (
                        <p className="text-xs text-[#D4A017]/70">
                          Creating WooCommerce products — each product requires an API call to the store.
                        </p>
                      )}
                      {exportElapsed >= 90 && (
                        <p className="text-xs text-amber-500 flex items-center gap-1">
                          <AlertTriangle size={12} /> Large catalog — WordPress store may be throttling. Do not close this page.
                        </p>
                      )}
                    </div>
                  )}

                  {exportResult && (
                    <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5 space-y-3">
                      <h3 className="font-semibold text-green-600 flex items-center gap-2">
                        <CheckCircle2 size={18} /> Export complete
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          ['Created', exportResult.created, true],
                          ['Updated', exportResult.updated, false],
                          ['Skipped', exportResult.skipped, false]
                        ].map(([label, value, accent]) => (
                          <div key={label as string} className={`rounded-lg border p-3 text-center ${accent ? 'border-[#D4A017]/30 bg-[#D4A017]/5' : 'border-border bg-background/50'}`}>
                            <div className={`text-xl font-bold tabular-nums ${accent ? 'text-[#D4A017]' : 'text-white'}`}>{value}</div>
                            <div className="text-xs text-muted-foreground mt-1">{label}</div>
                          </div>
                        ))}
                      </div>
                      {exportResult.errors?.length > 0 && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                          <p className="text-sm font-medium text-red-600 mb-2">{exportResult.errors.length} error(s)</p>
                          <ul className="text-xs text-red-500 space-y-1">
                            {exportResult.errors.slice(0, 5).map((e: any, i: number) => (
                              <li key={i}><span className="font-mono">{e.sku}</span>: {e.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
