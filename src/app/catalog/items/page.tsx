'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { 
  listCatalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem,
  listOrganizations, listBusinessUnits, listTaxCodes
} from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2, Plus, X } from 'lucide-react';

type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  status: 'active' | 'inactive' | 'discontinued';
  organizationId: string;
  organization?: {
    id: string;
    name: string;
  };
  businessUnit?: {
    id: string;
    code: string;
    name: string;
  } | null;
  taxCode?: {
    id: string;
    code: string;
    name: string;
  } | null;
  variants?: Array<{
    id: string;
    variantSku: string;
    name?: string;
  }>;
  [key: string]: any;
};

export default function CatalogItemsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALES_REP']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ 
    organizationId: '',
    businessUnitId: '',
    sku: '',
    name: '',
    description: '',
    longDescription: '',
    category: '',
    brand: '',
    manufacturer: '',
    hsCode: '',
    countryOfOrigin: '',
    taxCodeId: '',
    weightValue: '',
    weightUnit: 'kg' as 'g' | 'kg' | 'lb' | 'oz',
    lengthValue: '',
    widthValue: '',
    heightValue: '',
    dimensionUnit: 'cm' as 'cm' | 'm' | 'in' | 'ft',
    attributes: '',
    status: 'active' as 'active' | 'inactive' | 'discontinued'
  });
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [businessUnits, setBusinessUnits] = useState<any[]>([]);
  const [taxCodes, setTaxCodes] = useState<any[]>([]);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState({
    businessUnitId: '',
    sku: '',
    name: '',
    description: '',
    longDescription: '',
    category: '',
    brand: '',
    manufacturer: '',
    hsCode: '',
    countryOfOrigin: '',
    taxCodeId: '',
    weightValue: '',
    weightUnit: 'kg' as 'g' | 'kg' | 'lb' | 'oz',
    lengthValue: '',
    widthValue: '',
    heightValue: '',
    dimensionUnit: 'cm' as 'cm' | 'm' | 'in' | 'ft',
    attributes: '',
    status: 'active' as 'active' | 'inactive' | 'discontinued'
  });
  const [confirmDel, setConfirmDel] = useState<CatalogItem | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [itemsRes, orgsRes, taxCodesRes] = await Promise.all([
          listCatalogItems({ organizationId: session?.user?.organizationId }),
          listOrganizations(),
          listTaxCodes({ organizationId: session?.user?.organizationId })
        ]);
        setItems(itemsRes.data || []);
        setOrganizations(orgsRes.data || []);
        setTaxCodes(taxCodesRes.data || []);
        
        if (session?.user?.organizationId) {
          setForm(prev => ({ ...prev, organizationId: session.user.organizationId }));
          try {
            const busRes = await listBusinessUnits(session.user.organizationId);
            setBusinessUnits(busRes.data || []);
          } catch (e) {
            console.error('Failed to load business units:', e);
          }
        }
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) {
          toast.error('You do not have permission to view catalog items.');
        } else if (status === 401) {
          toast.error('Session expired. Please login again.');
          router.replace('/login');
        } else {
          toast.error('Failed to load catalog items');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (!form.organizationId || !form.sku || !form.name) {
      toast.error('Please fill in required fields (Organization, SKU, Name)');
      return;
    }
    try {
      const res = await createCatalogItem({
        organizationId: form.organizationId,
        businessUnitId: form.businessUnitId || undefined,
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        longDescription: form.longDescription || undefined,
        category: form.category || undefined,
        brand: form.brand || undefined,
        manufacturer: form.manufacturer || undefined,
        hsCode: form.hsCode || undefined,
        countryOfOrigin: form.countryOfOrigin || undefined,
        taxCodeId: form.taxCodeId || undefined,
        weightValue: form.weightValue ? parseFloat(form.weightValue) : undefined,
        weightUnit: form.weightUnit,
        lengthValue: form.lengthValue ? parseFloat(form.lengthValue) : undefined,
        widthValue: form.widthValue ? parseFloat(form.widthValue) : undefined,
        heightValue: form.heightValue ? parseFloat(form.heightValue) : undefined,
        dimensionUnit: form.dimensionUnit,
        attributes: form.attributes ? JSON.parse(form.attributes) : undefined,
        status: form.status
      });
      
      setItems([res.data, ...items]);
      setShowCreate(false);
      setForm({ 
        organizationId: session.user.organizationId || '',
        businessUnitId: '',
        sku: '',
        name: '',
        description: '',
        longDescription: '',
        category: '',
        brand: '',
        manufacturer: '',
        hsCode: '',
        countryOfOrigin: '',
        taxCodeId: '',
        weightValue: '',
        weightUnit: 'kg',
        lengthValue: '',
        widthValue: '',
        heightValue: '',
        dimensionUnit: 'cm',
        attributes: '',
        status: 'active'
      });
      toast.success('Catalog item created');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Create failed');
    }
  }

  useEffect(() => {
    if (form.organizationId) {
      listBusinessUnits(form.organizationId).then(res => {
        setBusinessUnits(res.data || []);
        setForm(prev => ({ ...prev, businessUnitId: '' }));
      }).catch(e => {
        console.error('Failed to load business units:', e);
        setBusinessUnits([]);
      });
    } else {
      setBusinessUnits([]);
    }
  }, [form.organizationId]);

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await updateCatalogItem(editing.id, {
        businessUnitId: editForm.businessUnitId || undefined,
        sku: editForm.sku,
        name: editForm.name,
        description: editForm.description || undefined,
        longDescription: editForm.longDescription || undefined,
        category: editForm.category || undefined,
        brand: editForm.brand || undefined,
        manufacturer: editForm.manufacturer || undefined,
        hsCode: editForm.hsCode || undefined,
        countryOfOrigin: editForm.countryOfOrigin || undefined,
        taxCodeId: editForm.taxCodeId || undefined,
        weightValue: editForm.weightValue ? parseFloat(editForm.weightValue) : undefined,
        weightUnit: editForm.weightUnit,
        lengthValue: editForm.lengthValue ? parseFloat(editForm.lengthValue) : undefined,
        widthValue: editForm.widthValue ? parseFloat(editForm.widthValue) : undefined,
        heightValue: editForm.heightValue ? parseFloat(editForm.heightValue) : undefined,
        dimensionUnit: editForm.dimensionUnit,
        attributes: editForm.attributes ? JSON.parse(editForm.attributes) : undefined,
        status: editForm.status
      });
      
      setItems(items.map(item => item.id === editing.id ? res.data : item));
      setEditing(null);
      toast.success('Catalog item updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Update failed');
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteCatalogItem(confirmDel.id);
      setItems(items.filter(item => item.id !== confirmDel.id));
      setConfirmDel(null);
      toast.success('Catalog item deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    }
  }

  const columns = useMemo<ColumnDef<CatalogItem>[]>(() => [
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.sku}</span>
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.brand && (
            <div className="text-xs text-muted-foreground">{row.original.brand}</div>
          )}
        </div>
      )
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => row.original.category || '-'
    },
    {
      accessorKey: 'businessUnit',
      header: 'Business Unit',
      cell: ({ row }) => row.original.businessUnit?.name || '-'
    },
    {
      accessorKey: 'variants',
      header: 'Variants',
      cell: ({ row }) => row.original.variants?.length || 0
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const colors = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
          discontinued: 'bg-red-100 text-red-800'
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status]}`}>
            {status}
          </span>
        );
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(item);
                setEditForm({
                  businessUnitId: item.businessUnit?.id || '',
                  sku: item.sku,
                  name: item.name,
                  description: item.description || '',
                  longDescription: item.longDescription || '',
                  category: item.category || '',
                  brand: item.brand || '',
                  manufacturer: item.manufacturer || '',
                  hsCode: item.hsCode || '',
                  countryOfOrigin: item.countryOfOrigin || '',
                  taxCodeId: item.taxCode?.id || '',
                  weightValue: item.weightValue?.toString() || '',
                  weightUnit: item.weightUnit || 'kg',
                  lengthValue: item.lengthValue?.toString() || '',
                  widthValue: item.widthValue?.toString() || '',
                  heightValue: item.heightValue?.toString() || '',
                  dimensionUnit: item.dimensionUnit || 'cm',
                  attributes: item.attributes ? JSON.stringify(item.attributes, null, 2) : '',
                  status: item.status
                });
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirmDel(item)}
              className="p-1 hover:bg-gray-100 rounded text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      }
    }
  ], []);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Catalog · Items" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
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
          <Header title="Catalog · Items" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
              </div>
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
        <Header title="Catalog · Items" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Catalog Items</h1>
                <p className="text-muted-foreground mt-1">Manage your product catalog</p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4A017] text-white rounded hover:bg-[#B89015]"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>

            <RichDataTable columns={columns} data={items} />

            {showCreate && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Create Catalog Item</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Organization *</label>
                        <select
                          value={form.organizationId}
                          onChange={e => setForm(prev => ({ ...prev, organizationId: e.target.value }))}
                          className="select"
                          required
                        >
                          <option value="">Select...</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Business Unit</label>
                        <select
                          value={form.businessUnitId}
                          onChange={e => setForm(prev => ({ ...prev, businessUnitId: e.target.value }))}
                          className="select"
                        >
                          <option value="">None</option>
                          {businessUnits.map(bu => (
                            <option key={bu.id} value={bu.id}>{bu.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">SKU *</label>
                        <input
                          type="text"
                          value={form.sku}
                          onChange={e => setForm(prev => ({ ...prev, sku: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name *</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Category</label>
                        <input
                          type="text"
                          value={form.category}
                          onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Brand</label>
                        <input
                          type="text"
                          value={form.brand}
                          onChange={e => setForm(prev => ({ ...prev, brand: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Manufacturer</label>
                        <input
                          type="text"
                          value={form.manufacturer}
                          onChange={e => setForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">HS Code</label>
                        <input
                          type="text"
                          value={form.hsCode}
                          onChange={e => setForm(prev => ({ ...prev, hsCode: e.target.value }))}
                          className="input"
                          placeholder="e.g., 1234.56.78"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Country of Origin</label>
                        <input
                          type="text"
                          maxLength={2}
                          value={form.countryOfOrigin}
                          onChange={e => setForm(prev => ({ ...prev, countryOfOrigin: e.target.value.toUpperCase() }))}
                          className="input"
                          placeholder="GB"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Tax Code</label>
                        <select
                          value={form.taxCodeId}
                          onChange={e => setForm(prev => ({ ...prev, taxCodeId: e.target.value }))}
                          className="select"
                        >
                          <option value="">None</option>
                          {taxCodes.map(tc => (
                            <option key={tc.id} value={tc.id}>{tc.code} - {tc.name} ({tc.rate * 100}%)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={form.status}
                          onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="discontinued">Discontinued</option>
                        </select>
                      </div>
                    </div>
                    <div className="border-t border-border pt-4 mt-4">
                      <h4 className="text-sm font-semibold mb-3">Physical Properties</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Weight Value</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={form.weightValue}
                            onChange={e => setForm(prev => ({ ...prev, weightValue: e.target.value }))}
                            className="input"
                            placeholder="0.0000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Weight Unit</label>
                          <select
                            value={form.weightUnit}
                            onChange={e => setForm(prev => ({ ...prev, weightUnit: e.target.value as any }))}
                            className="select"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Length</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.lengthValue}
                            onChange={e => setForm(prev => ({ ...prev, lengthValue: e.target.value }))}
                            className="input"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Width</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.widthValue}
                            onChange={e => setForm(prev => ({ ...prev, widthValue: e.target.value }))}
                            className="input"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Height</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.heightValue}
                            onChange={e => setForm(prev => ({ ...prev, heightValue: e.target.value }))}
                            className="input"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Dimension Unit</label>
                          <select
                            value={form.dimensionUnit}
                            onChange={e => setForm(prev => ({ ...prev, dimensionUnit: e.target.value as any }))}
                            className="select"
                          >
                            <option value="cm">cm</option>
                            <option value="m">m</option>
                            <option value="in">in</option>
                            <option value="ft">ft</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Description</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        className="input"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Long Description</label>
                      <textarea
                        value={form.longDescription}
                        onChange={e => setForm(prev => ({ ...prev, longDescription: e.target.value }))}
                        className="input"
                        rows={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Attributes (JSON)</label>
                      <textarea
                        value={form.attributes}
                        onChange={e => setForm(prev => ({ ...prev, attributes: e.target.value }))}
                        className="input font-mono text-xs"
                        rows={4}
                        placeholder='{"color": "red", "material": "cotton"}'
                      />
                      <p className="text-xs text-muted-foreground mt-1">Enter JSON object for custom attributes</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowCreate(false)}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editing && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Edit Catalog Item</h3>
                    <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <form onSubmit={onUpdate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">SKU *</label>
                        <input
                          type="text"
                          value={editForm.sku}
                          onChange={e => setEditForm(prev => ({ ...prev, sku: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name *</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Category</label>
                        <input
                          type="text"
                          value={editForm.category}
                          onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Brand</label>
                        <input
                          type="text"
                          value={editForm.brand}
                          onChange={e => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Manufacturer</label>
                        <input
                          type="text"
                          value={editForm.manufacturer}
                          onChange={e => setEditForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">HS Code</label>
                        <input
                          type="text"
                          value={editForm.hsCode}
                          onChange={e => setEditForm(prev => ({ ...prev, hsCode: e.target.value }))}
                          className="input"
                          placeholder="e.g., 1234.56.78"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Country of Origin</label>
                        <input
                          type="text"
                          maxLength={2}
                          value={editForm.countryOfOrigin}
                          onChange={e => setEditForm(prev => ({ ...prev, countryOfOrigin: e.target.value.toUpperCase() }))}
                          className="input"
                          placeholder="GB"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Tax Code</label>
                        <select
                          value={editForm.taxCodeId}
                          onChange={e => setEditForm(prev => ({ ...prev, taxCodeId: e.target.value }))}
                          className="select"
                        >
                          <option value="">None</option>
                          {taxCodes.map(tc => (
                            <option key={tc.id} value={tc.id}>{tc.code} - {tc.name} ({tc.rate * 100}%)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Status</label>
                        <select
                          value={editForm.status}
                          onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="select"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="discontinued">Discontinued</option>
                        </select>
                      </div>
                    </div>
                    <div className="border-t border-border pt-4 mt-4">
                      <h4 className="text-sm font-semibold mb-3">Physical Properties</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Weight Value</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={editForm.weightValue}
                            onChange={e => setEditForm(prev => ({ ...prev, weightValue: e.target.value }))}
                            className="input"
                            placeholder="0.0000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Weight Unit</label>
                          <select
                            value={editForm.weightUnit}
                            onChange={e => setEditForm(prev => ({ ...prev, weightUnit: e.target.value as any }))}
                            className="select"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Length</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.lengthValue}
                            onChange={e => setEditForm(prev => ({ ...prev, lengthValue: e.target.value }))}
                            className="input"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Width</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.widthValue}
                            onChange={e => setEditForm(prev => ({ ...prev, widthValue: e.target.value }))}
                            className="input"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Height</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.heightValue}
                            onChange={e => setEditForm(prev => ({ ...prev, heightValue: e.target.value }))}
                            className="input"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Dimension Unit</label>
                          <select
                            value={editForm.dimensionUnit}
                            onChange={e => setEditForm(prev => ({ ...prev, dimensionUnit: e.target.value as any }))}
                            className="select"
                          >
                            <option value="cm">cm</option>
                            <option value="m">m</option>
                            <option value="in">in</option>
                            <option value="ft">ft</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        className="input"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Long Description</label>
                      <textarea
                        value={editForm.longDescription}
                        onChange={e => setEditForm(prev => ({ ...prev, longDescription: e.target.value }))}
                        className="input"
                        rows={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Attributes (JSON)</label>
                      <textarea
                        value={editForm.attributes}
                        onChange={e => setEditForm(prev => ({ ...prev, attributes: e.target.value }))}
                        className="input font-mono text-xs"
                        rows={4}
                        placeholder='{"color": "red", "material": "cotton"}'
                      />
                      <p className="text-xs text-muted-foreground mt-1">Enter JSON object for custom attributes</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                      >
                        Update
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {confirmDel && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                  <p className="mb-4 text-muted-foreground">Are you sure you want to delete "{confirmDel.name}"? This action cannot be undone.</p>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                      onClick={() => setConfirmDel(null)}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onDelete}
                      className="btn bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

