'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { 
  listEmployees, listEmploymentContracts, listTimeEntries,
  listLeaveRequests, listShifts, listPayrollRuns,
  listTasks, listKpiDefinitions
} from '@/lib/api';
import { Users, FileText, Clock, Calendar, Briefcase, DollarSign, CheckSquare, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function HRDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalContracts: 0,
    pendingLeaveRequests: 0,
    totalTimeEntries: 0,
    totalShifts: 0,
    totalPayrollRuns: 0,
    pendingTasks: 0
  });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [empRes, contractRes, leaveRes, timeRes, shiftRes, payrollRes, taskRes] = await Promise.all([
          listEmployees({ organizationId: session?.user?.organizationId }),
          listEmploymentContracts({}),
          listLeaveRequests({ status: 'pending' }),
          listTimeEntries({}),
          listShifts({}),
          listPayrollRuns({ organizationId: session?.user?.organizationId }),
          listTasks({ organizationId: session?.user?.organizationId, status: 'pending' })
        ]);

        const employees = empRes.data || [];
        const activeEmployees = employees.filter((emp: any) => emp.status === 'active').length;

        setStats({
          totalEmployees: employees.length,
          activeEmployees,
          totalContracts: contractRes.data?.length || 0,
          pendingLeaveRequests: leaveRes.data?.length || 0,
          totalTimeEntries: timeRes.data?.length || 0,
          totalShifts: shiftRes.data?.length || 0,
          totalPayrollRuns: payrollRes.data?.length || 0,
          pendingTasks: taskRes.data?.length || 0
        });
      } catch (e: any) {
        console.error('Failed to load HR stats:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken, session?.user?.organizationId]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="HR · Dashboard" />
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
          <Header title="HR · Dashboard" />
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
        <Header title="HR · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">HR, Payroll & KPI Overview</h1>
              <p className="text-muted-foreground">Manage employees, contracts, time tracking, leave requests, payroll, and performance metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/hr/employees">
                <StatCard
                  title="Total Employees"
                  value={stats.totalEmployees.toString()}
                  icon={<Users className="h-5 w-5" />}
                  hint="Total employees"
                />
              </Link>
              <Link href="/hr/employees?status=active">
                <StatCard
                  title="Active Employees"
                  value={stats.activeEmployees.toString()}
                  icon={<Users className="h-5 w-5" />}
                  hint="Active employees"
                />
              </Link>
              <Link href="/hr/employment-contracts">
                <StatCard
                  title="Employment Contracts"
                  value={stats.totalContracts.toString()}
                  icon={<FileText className="h-5 w-5" />}
                  hint="Total contracts"
                />
              </Link>
              <Link href="/hr/leave-requests?status=pending">
                <StatCard
                  title="Pending Leave"
                  value={stats.pendingLeaveRequests.toString()}
                  icon={<Calendar className="h-5 w-5" />}
                  hint="Pending leave requests"
                />
              </Link>
              <Link href="/hr/time-entries">
                <StatCard
                  title="Time Entries"
                  value={stats.totalTimeEntries.toString()}
                  icon={<Clock className="h-5 w-5" />}
                  hint="Total time entries"
                />
              </Link>
              <Link href="/hr/shifts">
                <StatCard
                  title="Shifts"
                  value={stats.totalShifts.toString()}
                  icon={<Briefcase className="h-5 w-5" />}
                  hint="Total shifts"
                />
              </Link>
              <Link href="/hr/payroll-runs">
                <StatCard
                  title="Payroll Runs"
                  value={stats.totalPayrollRuns.toString()}
                  icon={<DollarSign className="h-5 w-5" />}
                  hint="Total payroll runs"
                />
              </Link>
              <Link href="/hr/tasks?status=pending">
                <StatCard
                  title="Pending Tasks"
                  value={stats.pendingTasks.toString()}
                  icon={<CheckSquare className="h-5 w-5" />}
                  hint="Pending tasks"
                />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              <Link
                href="/hr/employees"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Employees</h3>
                <p className="text-sm text-muted-foreground">Manage employee records and information</p>
              </Link>
              <Link
                href="/hr/employment-contracts"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Employment Contracts</h3>
                <p className="text-sm text-muted-foreground">Manage employment contracts and agreements</p>
              </Link>
              <Link
                href="/hr/time-entries"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Time Entries</h3>
                <p className="text-sm text-muted-foreground">Track clock-in/out and time worked</p>
              </Link>
              <Link
                href="/hr/leave-requests"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Leave Requests</h3>
                <p className="text-sm text-muted-foreground">Manage vacation and leave requests</p>
              </Link>
              <Link
                href="/hr/shifts"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Shifts</h3>
                <p className="text-sm text-muted-foreground">Schedule and manage work shifts</p>
              </Link>
              <Link
                href="/hr/payroll-runs"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Payroll</h3>
                <p className="text-sm text-muted-foreground">Process and manage payroll runs</p>
              </Link>
              <Link
                href="/hr/tasks"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Tasks</h3>
                <p className="text-sm text-muted-foreground">Assign and track work tasks</p>
              </Link>
              <Link
                href="/hr/kpi-definitions"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">KPI Definitions</h3>
                <p className="text-sm text-muted-foreground">Define and manage performance metrics</p>
              </Link>
              <Link
                href="/hr/kpi-records"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">KPI Records</h3>
                <p className="text-sm text-muted-foreground">Track and analyze performance data</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

