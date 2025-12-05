'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listWarehouses, listStockItems, listSuppliers, listPurchaseOrders } from '@/lib/api';
import { Warehouse, Package, ShoppingCart, TrendingUp, AlertTriangle, Boxes } from 'lucide-react';
import Link from 'next/link';

export default function InventoryDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWarehouses: 0,
    totalStockItems: 0,
    totalSuppliers: 0,
    activePurchaseOrders: 0,
    lowStockItems: 0,
    totalValue: 0
  });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [warehousesRes, stockItemsRes, suppliersRes, purchaseOrdersRes] = await Promise.all([
          listWarehouses(),
          listStockItems(),
          listSuppliers(),
          listPurchaseOrders({ status: 'draft' })
        ]);

        const stockItems = stockItemsRes.data || [];
        const lowStock = stockItems.filter((item: any) => 
          item.quantityAvailable <= item.reorderPoint && item.quantityAvailable > 0
        ).length;

        setStats({
          totalWarehouses: warehousesRes.data?.length || 0,
          totalStockItems: stockItems.length,
          totalSuppliers: suppliersRes.data?.length || 0,
          activePurchaseOrders: purchaseOrdersRes.data?.length || 0,
          lowStockItems: lowStock,
          totalValue: stockItems.reduce((sum: number, item: any) => 
            sum + (item.quantityOnHand * (item.costPrice || 0)), 0
          )
        });
      } catch (e: any) {
        console.error('Failed to load inventory stats:', e);
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
          <Header title="Inventory · Dashboard" />
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
          <Header title="Inventory · Dashboard" />
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
        <Header title="Inventory · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Inventory Overview</h1>
              <p className="text-muted-foreground">Manage warehouses, stock, suppliers, and purchase orders</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/inventory/warehouses">
                <StatCard
                  title="Warehouses"
                  value={stats.totalWarehouses.toString()}
                  icon={<Warehouse className="h-5 w-5" />}
                  hint="Total warehouses"
                />
              </Link>
              <Link href="/inventory/stock-items">
                <StatCard
                  title="Stock Items"
                  value={stats.totalStockItems.toString()}
                  icon={<Package className="h-5 w-5" />}
                  hint="Total stock items"
                />
              </Link>
              <Link href="/inventory/suppliers">
                <StatCard
                  title="Suppliers"
                  value={stats.totalSuppliers.toString()}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  hint="Active suppliers"
                />
              </Link>
              <Link href="/inventory/purchase-orders">
                <StatCard
                  title="Active POs"
                  value={stats.activePurchaseOrders.toString()}
                  icon={<TrendingUp className="h-5 w-5" />}
                  hint="Draft purchase orders"
                />
              </Link>
              <StatCard
                title="Low Stock"
                value={stats.lowStockItems.toString()}
                icon={<AlertTriangle className="h-5 w-5" />}
                hint="Items below reorder point"
              />
              <StatCard
                title="Total Value"
                value={`£${stats.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<Boxes className="h-5 w-5" />}
                hint="Inventory value at cost"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              <Link
                href="/inventory/warehouses"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Warehouses</h3>
                <p className="text-sm text-muted-foreground">Manage warehouse locations and settings</p>
              </Link>
              <Link
                href="/inventory/stock-items"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Stock Items</h3>
                <p className="text-sm text-muted-foreground">View and manage inventory levels</p>
              </Link>
              <Link
                href="/inventory/suppliers"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Suppliers</h3>
                <p className="text-sm text-muted-foreground">Manage supplier information</p>
              </Link>
              <Link
                href="/inventory/purchase-orders"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Purchase Orders</h3>
                <p className="text-sm text-muted-foreground">Create and track purchase orders</p>
              </Link>
              <Link
                href="/inventory/bins"
                className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">Bins</h3>
                <p className="text-sm text-muted-foreground">Manage storage bins and locations</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

