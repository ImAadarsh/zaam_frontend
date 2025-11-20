'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';

type User = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  status: 'active' | 'inactive' | 'suspended' | 'locked';
  organizationId: string;
  [key: string]: any;
};

export default function UsersPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', username: '', firstName: '', lastName: '' });
  const [editing, setEditing] = useState<User | null>(null);
  const [confirmDel, setConfirmDel] = useState<User | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const res = await listUsers();
        setItems(res.data);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) {
          toast.error('You do not have permission to view users. Please contact an administrator.');
        } else if (status === 401) {
          toast.error('Session expired. Please login again.');
          router.replace('/login');
        } else {
          toast.error('Failed to load users');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    try {
      const res = await createUser({
        organizationId: session.user.organizationId,
        email: form.email,
        username: form.username || undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        status: 'active'
      });
      setItems([res.data, ...items]);
      setShowCreate(false);
      setForm({ email: '', username: '', firstName: '', lastName: '' });
      toast.success('User created');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Create failed');
    }
  }

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (info) => <span className="font-medium">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'username',
      header: 'Username',
      cell: (info) => info.getValue() || <span className="text-muted-foreground italic">-</span>,
    },
    {
      id: 'name',
      header: 'Name',
      accessorFn: (row) => [row.firstName, row.lastName].filter(Boolean).join(' '),
      cell: (info) => info.getValue() || <span className="text-muted-foreground italic">-</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const colors: Record<string, string> = {
          active: 'bg-green-100 text-green-700 border-green-200',
          inactive: 'bg-gray-100 text-gray-700 border-gray-200',
          suspended: 'bg-red-100 text-red-700 border-red-200',
          locked: 'bg-orange-100 text-orange-700 border-orange-200',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
            {status}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setEditing(row.original)}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors"
            onClick={() => setConfirmDel(row.original)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], []);

  if (!hydrated || !hasAccess || !session?.accessToken) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header
          title="IAM · Users"
          actions={[
            { label: 'Add User', onClick: () => setShowCreate(true), icon: <Plus size={16} /> }
          ]}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Users</h2>
              <p className="text-muted-foreground">Manage user access and permissions.</p>
            </div>
            <button className="btn btn-primary gap-2" onClick={() => setShowCreate(true)}>
              <span>+ New User</span>
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center rounded-2xl border border-border bg-card/50 animate-pulse">
              Loading users...
            </div>
          ) : (
            <RichDataTable
              columns={columns}
              data={items}
              searchPlaceholder="Search users..."
            />
          )}

          {showCreate && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4">Create User</h3>
                <form onSubmit={onCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Email</label>
                      <input className="input" type="email" required
                        value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">First name</label>
                      <input className="input"
                        value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Last name</label>
                      <input className="input"
                        value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Username</label>
                      <input className="input"
                        value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Create User</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editing && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-4">Edit User</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const payload = {
                        email: editing.email,
                        username: editing.username ?? null,
                        firstName: editing.firstName ?? null,
                        lastName: editing.lastName ?? null,
                        status: editing.status
                      };
                      const res = await updateUser(editing.id, payload);
                      setItems(items.map((it) => (it.id === editing.id ? res.data : it)));
                      setEditing(null);
                      toast.success('User updated');
                    } catch (e: any) {
                      toast.error(e?.response?.data?.error?.message ?? 'Update failed');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Email</label>
                      <input className="input" type="email" required
                        value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">First name</label>
                      <input className="input"
                        value={editing.firstName ?? ''} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Last name</label>
                      <input className="input"
                        value={editing.lastName ?? ''} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Username</label>
                      <input className="input"
                        value={editing.username ?? ''} onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Status</label>
                      <select className="select"
                        value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                        <option value="suspended">suspended</option>
                        <option value="locked">locked</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDel && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold mb-2">Delete User</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Are you sure you want to delete <span className="font-medium text-foreground">{confirmDel.email}</span>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
                  <button
                    className="btn bg-red-600 hover:bg-red-700 text-white shadow-red-600/20"
                    onClick={async () => {
                      try {
                        await deleteUser(confirmDel.id);
                        setItems(items.filter((it) => it.id !== confirmDel.id));
                        setConfirmDel(null);
                        toast.success('User deleted');
                      } catch (e: any) {
                        toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
                      }
                    }}
                  >
                    Delete User
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
