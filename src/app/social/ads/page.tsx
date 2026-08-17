'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listMetaAdAccounts, listMetaAdCampaigns } from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { Megaphone } from 'lucide-react';

export default function SocialAdsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const { data } = await listMetaAdAccounts();
        setAccounts(data || []);
        if (data?.[0]?.id) setSelectedId(data[0].id);
      } catch (e: any) {
        toast.error(e.response?.data?.error?.message || 'Failed to load ad accounts');
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, hasAccess, router, session?.accessToken]);

  useEffect(() => {
    if (!selectedId) {
      setCampaigns([]);
      return;
    }
    (async () => {
      setLoadingCampaigns(true);
      try {
        const { data } = await listMetaAdCampaigns(selectedId);
        setCampaigns(data || []);
      } catch (e: any) {
        toast.error(e.response?.data?.error?.message || 'Failed to load campaigns');
        setCampaigns([]);
      } finally {
        setLoadingCampaigns(false);
      }
    })();
  }, [selectedId]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen app-surface">
        <Sidebar />
        <div className="flex flex-col overflow-hidden lg:ml-[280px]">
          <Header title="Social · Ads" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-muted-foreground animate-pulse">Loading...</div>
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
          <Header title="Social · Ads" />
          <main className="flex-1 p-6 flex justify-center items-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
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
        <Header title="Social · Ads" />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" /> Meta Ads
            </h1>
            <p className="text-muted-foreground text-sm">
              Synced ad accounts from Connect Meta — campaigns &amp; last 30 days insights
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
              No ad accounts synced yet. Use <strong>Connect Meta</strong> on the Accounts page (with ads permissions).
            </div>
          ) : (
            <>
              <div className="mb-4 max-w-md">
                <label className="text-sm font-medium">Ad account</label>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background outline-none"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.accountId})
                    </option>
                  ))}
                </select>
              </div>

              {loadingCampaigns ? (
                <div className="text-muted-foreground animate-pulse">Loading campaigns...</div>
              ) : (
                <div className="overflow-x-auto bg-card border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3 font-medium">Campaign</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">Objective</th>
                        <th className="p-3 font-medium">Impressions</th>
                        <th className="p-3 font-medium">Reach</th>
                        <th className="p-3 font-medium">Clicks</th>
                        <th className="p-3 font-medium">Spend</th>
                        <th className="p-3 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-muted-foreground">
                            No campaigns found for this ad account.
                          </td>
                        </tr>
                      ) : (
                        campaigns.map((c) => (
                          <tr key={c.id} className="border-t border-border">
                            <td className="p-3 font-medium">{c.name}</td>
                            <td className="p-3">{c.status}</td>
                            <td className="p-3">{c.objective || '—'}</td>
                            <td className="p-3">{c.insights?.impressions ?? '—'}</td>
                            <td className="p-3">{c.insights?.reach ?? '—'}</td>
                            <td className="p-3">{c.insights?.clicks ?? '—'}</td>
                            <td className="p-3">{c.insights?.spend ?? '—'}</td>
                            <td className="p-3">{c.insights?.ctr ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
