'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listSegments, listCampaigns, listCoupons, listAffiliates } from '@/lib/api';
import { Users, Megaphone, Tag, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function MarketingDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'MARKETING']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSegments: 0,
    totalCampaigns: 0,
    totalCoupons: 0,
    totalAffiliates: 0,
  });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [segRes, campRes, coupRes, affRes] = await Promise.all([
          listSegments(),
          listCampaigns(),
          listCoupons(),
          listAffiliates()
        ]);

        setStats({
          totalSegments: segRes.data?.length || 0,
          totalCampaigns: campRes.data?.length || 0,
          totalCoupons: coupRes.data?.length || 0,
          totalAffiliates: affRes.data?.length || 0,
        });
      } catch (e: any) {
        console.error('Failed to load marketing stats:', e);
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
          <Header title="Marketing · Dashboard" />
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
          <Header title="Marketing · Dashboard" />
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
        <Header title="Marketing · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Marketing Overview</h1>
              <p className="text-muted-foreground">Manage campaigns, segments, coupons, and affiliates</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/marketing/segments">
                <StatCard
                  title="Segments"
                  value={stats.totalSegments.toString()}
                  icon={<Users className="h-5 w-5" />}
                  hint="Customer segments"
                />
              </Link>
              <Link href="/marketing/campaigns">
                <StatCard
                  title="Campaigns"
                  value={stats.totalCampaigns.toString()}
                  icon={<Megaphone className="h-5 w-5" />}
                  hint="Marketing campaigns"
                />
              </Link>
              <Link href="/marketing/coupons">
                <StatCard
                  title="Coupons"
                  value={stats.totalCoupons.toString()}
                  icon={<Tag className="h-5 w-5" />}
                  hint="Active discount coupons"
                />
              </Link>
              <Link href="/marketing/affiliates">
                <StatCard
                  title="Affiliates"
                  value={stats.totalAffiliates.toString()}
                  icon={<Share2 className="h-5 w-5" />}
                  hint="Registered affiliates"
                />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <Link href="/marketing/segments" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Segments</h3>
                <p className="text-sm text-muted-foreground">Organize and target specific customer groups</p>
              </Link>
              <Link href="/marketing/campaigns" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Campaigns</h3>
                <p className="text-sm text-muted-foreground">Create and track marketing outreach</p>
              </Link>
              <Link href="/marketing/coupons" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Coupons</h3>
                <p className="text-sm text-muted-foreground">Manage promotional discounts and usage limits</p>
              </Link>
              <Link href="/marketing/affiliates" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Affiliates</h3>
                <p className="text-sm text-muted-foreground">Manage referral partnerships and payouts</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
