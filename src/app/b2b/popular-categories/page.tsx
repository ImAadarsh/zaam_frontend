'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listB2bCatalogCategories, listB2bPopularCategories, updateB2bPopularCategories } from '@/lib/api';
import { toast } from 'sonner';
import { LayoutGrid, Plus, Trash2 } from 'lucide-react';

type Tile = {
  id: string;
  label: string;
  icon: string;
  catSlug: string;
  brandsSubtitle: string;
  sortOrder: number;
  active: boolean;
};

type CatalogCategory = { slug: string; name: string };

function newTile(order: number): Tile {
  return {
    id: `tile-${Date.now()}-${order}`,
    label: '',
    icon: '📦',
    catSlug: '',
    brandsSubtitle: '',
    sortOrder: order,
    active: true
  };
}

export default function B2bPopularCategoriesPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP']);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [catsLoading, setCatsLoading] = useState(true);
  const orgId = session?.user?.organizationId;

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [tilesRes, catsRes] = await Promise.all([
          listB2bPopularCategories(orgId!),
          listB2bCatalogCategories(orgId!).catch(() => ({ data: [] as CatalogCategory[] }))
        ]);
        setTiles((tilesRes.data || []).map((t: any, i: number) => ({
          id: String(t.id || `tile-${i}`),
          label: t.label || '',
          icon: t.icon || '📦',
          catSlug: t.catSlug || '',
          brandsSubtitle: t.brandsSubtitle || '',
          sortOrder: Number(t.sortOrder ?? i + 1),
          active: t.active !== false
        })));
        setCategories(catsRes.data || []);
      } catch {
        toast.error('Failed to load popular categories');
      } finally {
        setLoading(false);
        setCatsLoading(false);
      }
    })();
  }, [hydrated, hasAccess, session?.accessToken, orgId]);

  const onCategoryChange = (index: number, slug: string) => {
    const next = [...tiles];
    const tile = next[index];
    const cat = categories.find((c) => c.slug === slug);
    next[index] = {
      ...tile,
      catSlug: slug,
      // Auto-fill Label when empty so picking a category is one step
      label: tile.label.trim() ? tile.label : (cat?.name || '')
    };
    setTiles(next);
  };

  const save = async () => {
    if (!orgId) return;
    const cleaned = tiles
      .map((t, i) => ({ ...t, sortOrder: i + 1, label: t.label.trim(), catSlug: t.catSlug.trim() }))
      .filter((t) => t.label && t.catSlug);
    if (cleaned.length === 0) {
      toast.error('Add at least one tile with label and category');
      return;
    }
    try {
      const res = await updateB2bPopularCategories({ organizationId: orgId, tiles: cleaned });
      setTiles(res.data || cleaned);
      toast.success('Popular categories saved');
    } catch {
      toast.error('Save failed');
    }
  };

  const categoryOptionsFor = (tile: Tile) => {
    if (!tile.catSlug || categories.some((c) => c.slug === tile.catSlug)) return categories;
    // Preserve orphaned saved slug (e.g. renamed/removed catalog category)
    return [{ slug: tile.catSlug, name: `${tile.catSlug} (not in catalog)` }, ...categories];
  };

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="B2B · Popular Categories" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-3xl">
          <div className="flex items-center gap-3">
            <LayoutGrid />
            <div>
              <h1 className="text-xl font-bold">Popular FMCG Categories</h1>
              <p className="text-sm text-muted-foreground">
                Dashboard tiles on the B2B portal. Pick a catalog category — it maps to{' '}
                <code className="text-xs">/shop?cat=…</code>.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              {!catsLoading && categories.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  No catalog categories yet. Publish products with a category, then refresh this page.
                </div>
              )}

              {tiles.map((tile, index) => (
                <div key={tile.id} className="bg-card border border-border rounded-2xl p-4 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                      placeholder="Icon (emoji)"
                      value={tile.icon}
                      onChange={(e) => {
                        const next = [...tiles];
                        next[index] = { ...tile, icon: e.target.value };
                        setTiles(next);
                      }}
                    />
                    <input
                      className="border border-border rounded-lg px-3 py-2 bg-background text-sm col-span-1 sm:col-span-2"
                      placeholder="Label (auto-fills from category)"
                      value={tile.label}
                      onChange={(e) => {
                        const next = [...tiles];
                        next[index] = { ...tile, label: e.target.value };
                        setTiles(next);
                      }}
                    />
                    <label className="flex items-center gap-2 text-sm px-1">
                      <input
                        type="checkbox"
                        checked={tile.active}
                        onChange={(e) => {
                          const next = [...tiles];
                          next[index] = { ...tile, active: e.target.checked };
                          setTiles(next);
                        }}
                      />
                      Active
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                      value={tile.catSlug}
                      disabled={catsLoading || (categories.length === 0 && !tile.catSlug)}
                      onChange={(e) => onCategoryChange(index, e.target.value)}
                    >
                      <option value="">
                        {catsLoading
                          ? 'Loading categories…'
                          : categories.length === 0
                            ? 'No categories available'
                            : 'Select category…'}
                      </option>
                      {categoryOptionsFor(tile).map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="border border-border rounded-lg px-3 py-2 bg-background text-sm"
                      placeholder="Brands subtitle"
                      value={tile.brandsSubtitle}
                      onChange={(e) => {
                        const next = [...tiles];
                        next[index] = { ...tile, brandsSubtitle: e.target.value };
                        setTiles(next);
                      }}
                    />
                  </div>
                  <button
                    className="text-xs text-destructive inline-flex items-center gap-1"
                    onClick={() => setTiles(tiles.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <button
                  className="inline-flex items-center gap-1 border border-border px-3 py-2 rounded-xl text-sm"
                  onClick={() => setTiles([...tiles, newTile(tiles.length + 1)])}
                >
                  <Plus size={14} /> Add tile
                </button>
                <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold">
                  Save tiles
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
