'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listRoles, createRole, assignRole, listUsers, updateRole } from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { RichDataTable } from '@/components/rich-data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, UserPlus, Settings, Check } from 'lucide-react';

type Role = {
  id: string;
  name: string;
  code: string;
  [key: string]: any;
};

export default function RolesPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', code: '' });
  const [assignForm, setAssignForm] = useState({ userId: '', roleId: '' });
  const [pagePermissions, setPagePermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [r, u] = await Promise.all([listRoles(), listUsers()]);
        setRoles(r.data);
        setUsers(u.data);
      } catch {
        toast.error('Failed to load roles');
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    try {
      const res = await createRole({
        organizationId: session.user.organizationId,
        name: createForm.name,
        code: createForm.code
      });
      setRoles([res.data, ...roles]);
      setShowCreate(false);
      setCreateForm({ name: '', code: '' });
      toast.success('Role created');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Create failed');
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    try {
      await assignRole({ userId: assignForm.userId, roleId: assignForm.roleId });
      setShowAssign(false);
      setAssignForm({ userId: '', roleId: '' });
      toast.success('Role assigned');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Assign failed');
    }
  }

  // IAM Pages configuration
  const iamPages = [
    { path: '/iam/dashboard', label: 'Dashboard (Overview)', key: 'iam.dashboard' },
    { path: '/iam/users', label: 'Users', key: 'iam.users' },
    { path: '/iam/roles', label: 'Roles', key: 'iam.roles' },
    { path: '/iam/audit-logs', label: 'Audit Logs', key: 'iam.audit-logs' },
    { path: '/iam/api-keys', label: 'API Keys', key: 'iam.api-keys' },
  ];

  function openPermissionsEditor(role: Role) {
    setSelectedRole(role);
    // Load existing permissions from role.permissions
    const permissions = role.permissions || {};
    const pages: Record<string, boolean> = {};
    iamPages.forEach(page => {
      pages[page.key] = permissions.pages?.includes(page.key) || false;
    });
    setPagePermissions(pages);
    setShowPermissions(true);
  }

  async function savePermissions() {
    if (!selectedRole) return;
    try {
      const pageKeys = Object.entries(pagePermissions)
        .filter(([_, enabled]) => enabled)
        .map(([key, _]) => key);
      
      const permissions = {
        ...(selectedRole.permissions || {}),
        pages: pageKeys
      };
      
      await updateRole(selectedRole.id, { permissions });
      // Update local state
      setRoles(roles.map(r => r.id === selectedRole.id ? { ...r, permissions } : r));
      setShowPermissions(false);
      setSelectedRole(null);
      toast.success('Permissions updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Failed to update permissions');
    }
  }

  const columns = useMemo<ColumnDef<Role>[]>(() => [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: (info) => <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: (info) => <span className="font-medium">{info.getValue() as string}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const role = info.row.original;
        return (
          <button
            onClick={() => openPermissionsEditor(role)}
            className="btn btn-outline btn-sm flex items-center gap-2"
          >
            <Settings size={14} />
            Edit Pages
          </button>
        );
      },
    },
  ], []);

  if (!hydrated || !hasAccess || !session?.accessToken) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header
          title="IAM · Roles"
          actions={[
            { label: 'New Role', onClick: () => setShowCreate(true), icon: <Plus size={16} /> },
            { label: 'Assign Role', onClick: () => setShowAssign(true), icon: <UserPlus size={16} /> }
          ]}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Roles</h2>
              <p className="text-muted-foreground">Manage roles and permissions.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline" onClick={() => setShowAssign(true)}>Assign Role</button>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Role</button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center rounded-2xl border border-border bg-card/50 animate-pulse">
              Loading roles...
            </div>
          ) : (
            <RichDataTable
              columns={columns}
              data={roles}
              searchPlaceholder="Search roles..."
            />
          )}

          {showCreate && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4">Create Role</h3>
                <form onSubmit={onCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Name</label>
                    <input className="input" required
                      value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Code</label>
                    <input className="input" required
                      value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Create Role</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showAssign && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4">Assign Role to User</h3>
                <form onSubmit={onAssign} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">User</label>
                    <select className="select" required
                      value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}>
                      <option value="">Select user</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Role</label>
                    <select className="select" required
                      value={assignForm.roleId} onChange={(e) => setAssignForm({ ...assignForm, roleId: e.target.value })}>
                      <option value="">Select role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn btn-outline" onClick={() => setShowAssign(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Assign Role</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showPermissions && selectedRole && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Edit Page Permissions</h3>
                    <p className="text-sm text-muted-foreground mt-1">Role: <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{selectedRole.code}</span> - {selectedRole.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPermissions(false);
                      setSelectedRole(null);
                      setPagePermissions({});
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-3 mb-6">
                  <p className="text-sm text-muted-foreground mb-4">Select which pages this role can access:</p>
                  {iamPages.map((page) => (
                    <label
                      key={page.key}
                      className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                    >
                      <div className="relative flex items-center justify-center w-5 h-5">
                        <input
                          type="checkbox"
                          checked={pagePermissions[page.key] || false}
                          onChange={(e) => {
                            setPagePermissions({
                              ...pagePermissions,
                              [page.key]: e.target.checked
                            });
                          }}
                          className="w-5 h-5 rounded border-2 border-border checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        />
                        {pagePermissions[page.key] && (
                          <Check size={14} className="absolute text-white pointer-events-none" strokeWidth={3} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{page.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{page.path}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setShowPermissions(false);
                      setSelectedRole(null);
                      setPagePermissions({});
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={savePermissions}
                  >
                    Save Permissions
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
