'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listEmployees, createEmployee, updateEmployee, deleteEmployee, listUsers } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, Plus, X } from 'lucide-react';

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hireDate: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern';
  status: 'active' | 'on_leave' | 'suspended' | 'terminated';
  organization?: { id: string; name: string };
  user?: { id: string; email: string } | null;
};

export default function EmployeesPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Employee[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    organizationId: '',
    userId: '',
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '' as 'male' | 'female' | 'other' | 'prefer_not_to_say' | '',
    maritalStatus: '' as 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '',
    nationalId: '',
    taxId: '',
    passportNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    countryCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    hireDate: '',
    terminationDate: '',
    employmentType: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern',
    status: 'active' as 'active' | 'on_leave' | 'suspended' | 'terminated',
    photoUrl: '',
    notes: ''
  });
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    userId: '',
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '' as 'male' | 'female' | 'other' | 'prefer_not_to_say' | '',
    maritalStatus: '' as 'single' | 'married' | 'divorced' | 'widowed' | 'other' | '',
    nationalId: '',
    taxId: '',
    passportNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    countryCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    hireDate: '',
    terminationDate: '',
    employmentType: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern',
    status: 'active' as 'active' | 'on_leave' | 'suspended' | 'terminated',
    photoUrl: '',
    notes: ''
  });
  const [confirmDel, setConfirmDel] = useState<Employee | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [empRes, usersRes] = await Promise.all([
          listEmployees({ organizationId: session?.user?.organizationId }),
          listUsers()
        ]);
        setItems(empRes.data || []);
        setUsers(usersRes.data || []);
        if (session?.user?.organizationId) {
          setForm(prev => ({ ...prev, organizationId: session.user.organizationId }));
        }
      } catch (e: any) {
        if (e?.response?.status === 403) {
          toast.error('You do not have permission to view employees.');
        } else {
          toast.error('Failed to load employees');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organizationId || !form.employeeNumber || !form.firstName || !form.lastName || !form.hireDate) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      await createEmployee({
        ...form,
        userId: form.userId || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        maritalStatus: form.maritalStatus || undefined,
        nationalId: form.nationalId || undefined,
        taxId: form.taxId || undefined,
        passportNumber: form.passportNumber || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        stateProvince: form.stateProvince || undefined,
        postalCode: form.postalCode || undefined,
        countryCode: form.countryCode || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        emergencyContactRelationship: form.emergencyContactRelationship || undefined,
        terminationDate: form.terminationDate || undefined,
        photoUrl: form.photoUrl || undefined,
        notes: form.notes || undefined
      });
      toast.success('Employee created');
      setShowCreate(false);
      setForm({
        organizationId: session?.user?.organizationId || '',
        userId: '',
        employeeNumber: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        maritalStatus: '',
        nationalId: '',
        taxId: '',
        passportNumber: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        countryCode: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelationship: '',
        hireDate: '',
        terminationDate: '',
        employmentType: 'full_time',
        status: 'active',
        photoUrl: '',
        notes: ''
      });
      const res = await listEmployees({ organizationId: session?.user?.organizationId });
      setItems(res.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to create employee');
    }
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editForm.employeeNumber || !editForm.firstName || !editForm.lastName) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      await updateEmployee(editing.id, {
        ...editForm,
        userId: editForm.userId || undefined,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        gender: editForm.gender || undefined,
        maritalStatus: editForm.maritalStatus || undefined,
        nationalId: editForm.nationalId || undefined,
        taxId: editForm.taxId || undefined,
        passportNumber: editForm.passportNumber || undefined,
        addressLine1: editForm.addressLine1 || undefined,
        addressLine2: editForm.addressLine2 || undefined,
        city: editForm.city || undefined,
        stateProvince: editForm.stateProvince || undefined,
        postalCode: editForm.postalCode || undefined,
        countryCode: editForm.countryCode || undefined,
        emergencyContactName: editForm.emergencyContactName || undefined,
        emergencyContactPhone: editForm.emergencyContactPhone || undefined,
        emergencyContactRelationship: editForm.emergencyContactRelationship || undefined,
        terminationDate: editForm.terminationDate || undefined,
        photoUrl: editForm.photoUrl || undefined,
        notes: editForm.notes || undefined
      });
      toast.success('Employee updated');
      setEditing(null);
      const res = await listEmployees({ organizationId: session?.user?.organizationId });
      setItems(res.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to update employee');
    }
  }

  async function onDelete() {
    if (!confirmDel) return;
    try {
      await deleteEmployee(confirmDel.id);
      toast.success('Employee deleted');
      setConfirmDel(null);
      const res = await listEmployees({ organizationId: session?.user?.organizationId });
      setItems(res.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to delete employee');
    }
  }

  const columns = useMemo<ColumnDef<Employee>[]>(() => [
    { accessorKey: 'employeeNumber', header: 'Employee #' },
    { 
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`
    },
    { 
      accessorKey: 'email', 
      header: 'Email',
      cell: ({ row }) => row.original.email || '-'
    },
    { 
      accessorKey: 'phone', 
      header: 'Phone',
      cell: ({ row }) => row.original.phone || '-'
    },
    { 
      accessorKey: 'hireDate', 
      header: 'Hire Date',
      cell: ({ row }) => row.original.hireDate ? new Date(row.original.hireDate).toLocaleDateString() : '-'
    },
    { 
      accessorKey: 'employmentType', 
      header: 'Type',
      cell: ({ row }) => row.original.employmentType.replace(/_/g, ' ').toUpperCase()
    },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => {
            const item = row.original;
            setEditing(item);
            setEditForm({
              userId: (item as any).user?.id || '',
              employeeNumber: item.employeeNumber,
              firstName: item.firstName,
              lastName: item.lastName,
              email: item.email || '',
              phone: item.phone || '',
              dateOfBirth: (item as any).dateOfBirth || '',
              gender: (item as any).gender || '',
              maritalStatus: (item as any).maritalStatus || '',
              nationalId: (item as any).nationalId || '',
              taxId: (item as any).taxId || '',
              passportNumber: (item as any).passportNumber || '',
              addressLine1: (item as any).addressLine1 || '',
              addressLine2: (item as any).addressLine2 || '',
              city: (item as any).city || '',
              stateProvince: (item as any).stateProvince || '',
              postalCode: (item as any).postalCode || '',
              countryCode: (item as any).countryCode || '',
              emergencyContactName: (item as any).emergencyContactName || '',
              emergencyContactPhone: (item as any).emergencyContactPhone || '',
              emergencyContactRelationship: (item as any).emergencyContactRelationship || '',
              hireDate: item.hireDate,
              terminationDate: (item as any).terminationDate || '',
              employmentType: item.employmentType,
              status: item.status,
              photoUrl: (item as any).photoUrl || '',
              notes: (item as any).notes || ''
            });
          }} className="p-1.5 hover:bg-muted rounded">
            <Pencil size={16} />
          </button>
          <button onClick={() => setConfirmDel(row.original)} className="p-1.5 hover:bg-muted rounded text-destructive">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ], []);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="HR · Employees" />
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
          <Header title="HR · Employees" />
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
        <Header title="HR · Employees" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Employees</h1>
                <p className="text-muted-foreground mt-1">Manage employee records and information</p>
              </div>
              {hasAccess && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  <Plus size={20} />
                  New Employee
                </button>
              )}
            </div>

            <RichDataTable data={items} columns={columns} />

            {showCreate && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-card rounded-lg border border-border max-w-3xl w-full max-h-[90vh] overflow-auto">
                  <div className="p-6 border-b border-border flex items-center justify-between">
                    <h2 className="text-xl font-bold">Create Employee</h2>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-muted rounded">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={onCreate} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Employee Number *</label>
                        <input
                          type="text"
                          value={form.employeeNumber}
                          onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">User Account</label>
                        <select
                          value={form.userId}
                          onChange={(e) => setForm({ ...form, userId: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        >
                          <option value="">None</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.email}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">First Name *</label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                          type="text"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Hire Date *</label>
                        <input
                          type="date"
                          value={form.hireDate}
                          onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Employment Type</label>
                        <select
                          value={form.employmentType}
                          onChange={(e) => setForm({ ...form, employmentType: e.target.value as any })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        >
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                          <option value="temporary">Temporary</option>
                          <option value="intern">Intern</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        >
                          <option value="active">Active</option>
                          <option value="on_leave">On Leave</option>
                          <option value="suspended">Suspended</option>
                          <option value="terminated">Terminated</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        Create
                      </button>
                      <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-muted">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {editing && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-card rounded-lg border border-border max-w-3xl w-full max-h-[90vh] overflow-auto">
                  <div className="p-6 border-b border-border flex items-center justify-between">
                    <h2 className="text-xl font-bold">Edit Employee</h2>
                    <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={onUpdate} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Employee Number *</label>
                        <input
                          type="text"
                          value={editForm.employeeNumber}
                          onChange={(e) => setEditForm({ ...editForm, employeeNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">User Account</label>
                        <select
                          value={editForm.userId}
                          onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        >
                          <option value="">None</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.email}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">First Name *</label>
                        <input
                          type="text"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={editForm.lastName}
                          onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Hire Date</label>
                        <input
                          type="date"
                          value={editForm.hireDate}
                          onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Employment Type</label>
                        <select
                          value={editForm.employmentType}
                          onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value as any })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                        >
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                          <option value="temporary">Temporary</option>
                          <option value="intern">Intern</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                      >
                        <option value="active">Active</option>
                        <option value="on_leave">On Leave</option>
                        <option value="suspended">Suspended</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                        Update
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-muted">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {confirmDel && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-card rounded-lg border border-border max-w-md w-full p-6">
                  <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
                  <p className="text-muted-foreground mb-6">
                    Are you sure you want to delete employee "{confirmDel.firstName} {confirmDel.lastName}"? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={onDelete}
                      className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDel(null)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      Cancel
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

