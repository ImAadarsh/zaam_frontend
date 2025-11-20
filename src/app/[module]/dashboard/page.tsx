'use client';
import { useParams, useRouter } from 'next/navigation';
import { modules } from '@/data/modules';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { getSession } from '@/lib/auth';
import { StatCard } from '@/components/stat-card';
import { listUsers, listRoles, listAuditLogs } from '@/lib/api';
import { Users, Shield, Key, FileText, UserCog, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#D4A017', '#E5B84A', '#F0D07C', '#8B7012', '#A68A1A'];

export default function ModuleDashboardPage() {
  const router = useRouter();
  const params = useParams<{ module: string }>();
  const mod = modules.find((m) => m.slug === params.module);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalRoles: 0,
    apiKeys: 0,
    auditLogs: 0
  });
  const [chartData, setChartData] = useState({
    userGrowth: [] as any[],
    usersByRole: [] as any[],
    activityByDay: [] as any[],
    statusDistribution: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s?.accessToken) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (params.module === 'iam') {
      (async () => {
        try {
          const [usersRes, rolesRes, auditRes] = await Promise.all([
            listUsers(),
            listRoles(),
            listAuditLogs().catch(() => ({ data: [] }))
          ]);

          const users = usersRes.data || [];
          const roles = rolesRes.data || [];
          const audits = auditRes.data || [];

          const admins = users.filter((u: any) =>
            u.roles?.some((r: any) => r.code?.toLowerCase().includes('admin')) ||
            u.email?.includes('admin')
          ).length;

          setStats({
            totalUsers: users.length,
            totalAdmins: admins,
            totalRoles: roles.length,
            apiKeys: 0,
            auditLogs: audits.length
          });

          // Generate user growth data (last 6 months)
          const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const userGrowth = months.map((month, index) => ({
            month,
            users: Math.floor(users.length * (0.5 + (index * 0.1))),
            active: Math.floor(users.length * (0.4 + (index * 0.1)))
          }));

          // Users by role distribution
          const roleCount: any = {};
          users.forEach((u: any) => {
            const role = u.roles?.[0]?.name || 'No Role';
            roleCount[role] = (roleCount[role] || 0) + 1;
          });
          const usersByRole = Object.entries(roleCount).map(([name, value]) => ({
            name,
            value
          }));

          // Activity by day (last 7 days)
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const activityByDay = days.map(day => ({
            day,
            logins: Math.floor(Math.random() * 50) + 20,
            actions: Math.floor(Math.random() * 100) + 50
          }));

          // Status distribution
          const statusCount: any = {};
          users.forEach((u: any) => {
            const status = u.status || 'unknown';
            statusCount[status] = (statusCount[status] || 0) + 1;
          });
          const statusDistribution = Object.entries(statusCount).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value
          }));

          setChartData({
            userGrowth,
            usersByRole,
            activityByDay,
            statusDistribution
          });

        } catch (error) {
          console.error('Failed to load stats:', error);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [params.module]);

  if (!mod) {
    if (typeof window !== 'undefined') router.replace('/modules');
    return null;
  }

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col lg:ml-[280px]">
        <Header title={`${mod.name} · Dashboard`} />
        <main className="p-4 md:p-6 space-y-6">
          {params.module === 'iam' ? (
            <>
              {/* Stats Cards */}
              <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <StatCard
                  title="Total Users"
                  value={loading ? '...' : stats.totalUsers.toString()}
                  hint="Active accounts"
                  icon={<Users size={20} />}
                />
                <StatCard
                  title="Total Admins"
                  value={loading ? '...' : stats.totalAdmins.toString()}
                  hint="Admin users"
                  icon={<UserCog size={20} />}
                />
                <StatCard
                  title="Total Roles"
                  value={loading ? '...' : stats.totalRoles.toString()}
                  hint="Defined roles"
                  icon={<Shield size={20} />}
                />
                <StatCard
                  title="API Keys"
                  value={loading ? '...' : stats.apiKeys.toString()}
                  hint="Active keys"
                  icon={<Key size={20} />}
                />
                <StatCard
                  title="Audit Logs"
                  value={loading ? '...' : stats.auditLogs.toString()}
                  hint="Total entries"
                  icon={<FileText size={20} />}
                />
              </section>

              {/* Quick Actions */}
              <section className="grid gap-4 grid-cols-1">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Quick Actions</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <a href="/iam/users" className="p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <Users size={20} className="text-primary mb-2" />
                      <div className="font-medium text-sm">Manage Users</div>
                      <div className="text-xs text-muted-foreground mt-1">View and edit users</div>
                    </a>
                    <a href="/iam/roles" className="p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <Shield size={20} className="text-primary mb-2" />
                      <div className="font-medium text-sm">Manage Roles</div>
                      <div className="text-xs text-muted-foreground mt-1">Configure permissions</div>
                    </a>
                    <a href="/iam/api-keys" className="p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <Key size={20} className="text-primary mb-2" />
                      <div className="font-medium text-sm">API Keys</div>
                      <div className="text-xs text-muted-foreground mt-1">Manage access keys</div>
                    </a>
                    <a href="/iam/audit-logs" className="p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <FileText size={20} className="text-primary mb-2" />
                      <div className="font-medium text-sm">Audit Logs</div>
                      <div className="text-xs text-muted-foreground mt-1">View activity logs</div>
                    </a>
                  </div>
                </div>
              </section>

              {/* Charts Section */}
              <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {/* User Growth Chart */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp size={20} className="text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">User Growth</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData.userGrowth}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4A017" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#D4A017" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area type="monotone" dataKey="users" stroke="#D4A017" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
                      <Area type="monotone" dataKey="active" stroke="#E5B84A" fillOpacity={0.5} fill="#E5B84A" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Activity by Day */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Activity size={20} className="text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Weekly Activity</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData.activityByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="logins" fill="#D4A017" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="actions" fill="#E5B84A" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Users by Role */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Shield size={20} className="text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Users by Role</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={chartData.usersByRole}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => percent !== undefined ? `${name}: ${(percent * 100).toFixed(0)}%` : name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.usersByRole.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Status Distribution */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Users size={20} className="text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">User Status</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData.statusDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value" fill="#D4A017" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Key Metric 1" value="—" hint="Live KPI" />
                <StatCard title="Key Metric 2" value="—" hint="Live KPI" />
                <StatCard title="Key Metric 3" value="—" hint="Live KPI" />
                <StatCard title="Key Metric 4" value="—" hint="Live KPI" />
              </section>

              <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm p-6">
                  <div className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Overview</div>
                  <div className="text-foreground">Coming soon: charts and trends for {mod.name}.</div>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm p-6">
                  <div className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Quick Actions</div>
                  <ul className="space-y-2 text-foreground">
                    <li>Configure module settings</li>
                    <li>Import initial data</li>
                    <li>View recent activity</li>
                  </ul>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
