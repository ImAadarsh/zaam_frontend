'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listOrganizations, createOrganization, updateOrganization, createOrganizationWithLogo, getCurrentUser } from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { Plus, Building2, Edit2, Save, X } from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: string;
  updatedAt?: string;
};

export default function OrganizationsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Organization>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    loadData();
  }, [hydrated, router, session?.accessToken]);

  async function loadData() {
    try {
      const [orgsRes, userRes] = await Promise.all([
        listOrganizations(),
        getCurrentUser().catch(() => null)
      ]);
      setOrganizations(orgsRes.data || []);
      if (userRes?.data?.roles) {
        setIsSuperAdmin(userRes.data.roles.includes('SUPER_ADMIN'));
      }
    } catch (e: any) {
      toast.error('Failed to load organizations');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(org: Organization) {
    setEditingId(org.id);
    setFormData({
      name: org.name,
      legalName: org.legalName || '',
      taxId: org.taxId || '',
      registrationNumber: org.registrationNumber || '',
      website: org.website || '',
      phone: org.phone || '',
      email: org.email || '',
      logoUrl: org.logoUrl || '',
      status: org.status
    });
    setLogoFile(null);
    setLogoPreview(org.logoUrl || null);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({});
    setLogoFile(null);
    setLogoPreview(null);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload an image (JPEG, PNG, WebP, or SVG)');
        return;
      }
      
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }

      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSave(id: string | null) {
    try {
      if (id) {
        // Update existing
        const res = await updateOrganization(id, formData, logoFile || undefined);
        toast.success('Organization updated');
        setOrganizations(orgs => orgs.map(o => o.id === id ? res.data : o));
      } else {
        // Create new
        const res = await createOrganization(formData as any, logoFile || undefined);
        setOrganizations([res.data, ...organizations]);
        toast.success('Organization created');
        setShowCreate(false);
        setFormData({});
        setLogoFile(null);
        setLogoPreview(null);
      }
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Operation failed');
    }
  }

  function canEdit(org: Organization): boolean {
    if (isSuperAdmin) return true;
    // Admin can only edit their own organization
    return session?.user?.organizationId === org.id;
  }

  if (!hydrated || !session?.accessToken) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header
          title="IAM · Organizations"
          actions={
            isSuperAdmin
              ? [{ label: 'New Organization', onClick: () => { 
                  setShowCreate(true); 
                  setFormData({ status: 'active' }); 
                  setLogoFile(null);
                  setLogoPreview(null);
                }, icon: <Plus size={16} /> }]
              : []
          }
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Organizations</h2>
              <p className="text-muted-foreground">
                {isSuperAdmin ? 'Manage all organizations' : 'View your organization'}
              </p>
            </div>
            {isSuperAdmin && (
              <button className="btn btn-primary" onClick={() => { 
                setShowCreate(true); 
                setFormData({ status: 'active' }); 
                setLogoFile(null);
                setLogoPreview(null);
              }}>
                <Plus size={16} className="mr-2" />
                New Organization
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center rounded-2xl border border-border bg-card/50 animate-pulse">
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-border bg-card">
              <Building2 size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No organizations found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-all"
                >
                  {editingId === org.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Name *</label>
                          <input
                            className="input"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Legal Name</label>
                          <input
                            className="input"
                            value={formData.legalName || ''}
                            onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Tax ID</label>
                          <input
                            className="input"
                            value={formData.taxId || ''}
                            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Registration Number</label>
                          <input
                            className="input"
                            value={formData.registrationNumber || ''}
                            onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Website</label>
                          <input
                            className="input"
                            type="url"
                            value={formData.website || ''}
                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Phone</label>
                          <input
                            className="input"
                            type="tel"
                            value={formData.phone || ''}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Email</label>
                          <input
                            className="input"
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1.5">Logo</label>
                          <div className="flex items-center gap-4">
                            {(logoPreview || formData.logoUrl) && (
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                                <img
                                  src={logoPreview || formData.logoUrl || ''}
                                  alt="Logo preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                onChange={handleLogoChange}
                                className="input"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Upload a logo (JPEG, PNG, WebP, or SVG). Max 2MB.
                              </p>
                            </div>
                          </div>
                        </div>
                        {isSuperAdmin && (
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Status</label>
                            <select
                              className="select"
                              value={formData.status || 'active'}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button className="btn btn-outline" onClick={cancelEdit}>
                          <X size={16} className="mr-2" />
                          Cancel
                        </button>
                        <button className="btn btn-primary" onClick={() => handleSave(org.id)}>
                          <Save size={16} className="mr-2" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      {org.logoUrl && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
                          <img
                            src={org.logoUrl}
                            alt={`${org.name} logo`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{org.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            org.status === 'active' ? 'bg-green-500/20 text-green-500' :
                            org.status === 'inactive' ? 'bg-gray-500/20 text-gray-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                            {org.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mt-4">
                          {org.legalName && <div><strong>Legal Name:</strong> {org.legalName}</div>}
                          {org.taxId && <div><strong>Tax ID:</strong> {org.taxId}</div>}
                          {org.registrationNumber && <div><strong>Registration:</strong> {org.registrationNumber}</div>}
                          {org.website && <div><strong>Website:</strong> <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{org.website}</a></div>}
                          {org.phone && <div><strong>Phone:</strong> {org.phone}</div>}
                          {org.email && <div><strong>Email:</strong> {org.email}</div>}
                        </div>
                      </div>
                      {canEdit(org) && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => startEdit(org)}
                        >
                          <Edit2 size={14} className="mr-2" />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showCreate && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Create Organization</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Name *</label>
                      <input
                        className="input"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Legal Name</label>
                      <input
                        className="input"
                        value={formData.legalName || ''}
                        onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Tax ID</label>
                      <input
                        className="input"
                        value={formData.taxId || ''}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Registration Number</label>
                      <input
                        className="input"
                        value={formData.registrationNumber || ''}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Website</label>
                      <input
                        className="input"
                        type="url"
                        value={formData.website || ''}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Phone</label>
                      <input
                        className="input"
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Email</label>
                      <input
                        className="input"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Logo</label>
                      <div className="flex items-center gap-4">
                        {logoPreview && (
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            onChange={handleLogoChange}
                            className="input"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Upload a logo (JPEG, PNG, WebP, or SVG). Max 2MB.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Status</label>
                      <select
                        className="select"
                        value={formData.status || 'active'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setShowCreate(false);
                        setFormData({});
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSave(null)}
                    >
                      Create Organization
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

