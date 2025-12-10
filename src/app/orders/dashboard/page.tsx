'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listCustomers, listOrders, listReturns } from '@/lib/api';
import { Users, ShoppingCart, RotateCcw, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function OrdersDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalReturns: 0,
    totalRevenue: 0,
    pendingReturns: 0
  });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [customersRes, ordersRes, returnsRes] = await Promise.all([
          listCustomers({ organizationId: session?.user?.organizationId }),
          listOrders({ organizationId: session?.user?.organizationId }),
          listReturns({ organizationId: session?.user?.organizationId })
        ]);

        const orders = ordersRes.data || [];
        const returns = returnsRes.data || [];
        const pendingOrders = orders.filter((o: any) => 
          o.status === 'pending' || o.status === 'processing'
        ).length;
        const pendingReturns = returns.filter((r: any) => 
          r.status === 'requested' || r.status === 'approved'
        ).length;
        const totalRevenue = orders
          .filter((o: any) => o.status === 'completed' || o.status === 'processing')
          .reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0);

        setStats({
          totalCustomers: customersRes.data?.length || 0,
          totalOrders: orders.length,
          pendingOrders,
          totalReturns: returns.length,
          totalRevenue,
          pendingReturns
        });
      } catch (e: any) {
        console.error('Failed to load orders stats:', e);
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
          <Header title="Orders · Dashboard" />
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
          <Header title="Orders · Dashboard" />
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
        <Header title="Orders · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Orders Overview</h1>
              <p className="text-muted-foreground">Manage customers, orders, and returns</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/orders/customers">
                <StatCard
                  title="Customers"
                  value={stats.totalCustomers.toString()}
                  icon={<Users className="h-5 w-5" />}
                  hint="Total customers"
                />
              </Link>
              <Link href="/orders/orders">
                <StatCard
                  title="Total Orders"
                  value={stats.totalOrders.toString()}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  hint="All orders"
                />
              </Link>
              <Link href="/orders/orders?status=pending">
                <StatCard
                  title="Pending Orders"
                  value={stats.pendingOrders.toString()}
                  icon={<AlertCircle className="h-5 w-5" />}
                  hint="Orders pending processing"
                />
              </Link>
              <Link href="/orders/returns">
                <StatCard
                  title="Returns"
                  value={stats.totalReturns.toString()}
                  icon={<RotateCcw className="h-5 w-5" />}
                  hint="Total returns"
                />
              </Link>
              <Link href="/orders/returns?status=requested">
                <StatCard
                  title="Pending Returns"
                  value={stats.pendingReturns.toString()}
                  icon={<AlertCircle className="h-5 w-5" />}
                  hint="Returns awaiting action"
                />
              </Link>
              <StatCard
                title="Total Revenue"
                value={`£${stats.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<DollarSign className="h-5 w-5" />}
                hint="Revenue from completed orders"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              <Link
                href="/orders/customers"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Customers</h3>
                <p className="text-sm text-muted-foreground">Manage customer information and addresses</p>
              </Link>
              <Link
                href="/orders/orders"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Orders</h3>
                <p className="text-sm text-muted-foreground">View and manage sales orders from all channels</p>
              </Link>
              <Link
                href="/orders/returns"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Returns</h3>
                <p className="text-sm text-muted-foreground">Process returns and refunds</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

