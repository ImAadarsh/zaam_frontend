'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { StatCard } from '@/components/stat-card';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listSocialAccounts, listSocialPosts, listCreators, listSocialMessages } from '@/lib/api';
import { Users, Share2, MessageSquare, AtSign } from 'lucide-react';
import Link from 'next/link';

export default function SocialDashboard() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    accounts: 0,
    posts: 0,
    creators: 0,
    messages: 0,
  });

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const [accRes, postRes, creatorRes, msgRes] = await Promise.all([
          listSocialAccounts(),
          listSocialPosts(),
          listCreators(),
          listSocialMessages()
        ]);

        setStats({
          accounts: accRes.data?.length || 0,
          posts: postRes.data?.length || 0,
          creators: creatorRes.data?.length || 0,
          messages: msgRes.data?.length || 0,
        });
      } catch (e: any) {
        console.error('Failed to load social stats:', e);
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
          <Header title="Social · Dashboard" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground animate-pulse">Loading...</div>
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
          <Header title="Social · Dashboard" />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2 text-destructive">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view the Social Dashboard.</p>
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
        <Header title="Social · Dashboard" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Social Media Overview</h1>
              <p className="text-muted-foreground">Manage social accounts, posts, influencers, and messages</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/social/accounts">
                <StatCard title="Accounts Linked" value={stats.accounts.toString()} icon={<AtSign className="h-5 w-5" />} hint="Connected platforms" />
              </Link>
              <Link href="/social/posts">
                <StatCard title="Posts" value={stats.posts.toString()} icon={<Share2 className="h-5 w-5" />} hint="Total posts logged" />
              </Link>
              <Link href="/social/creators">
                <StatCard title="Creators" value={stats.creators.toString()} icon={<Users className="h-5 w-5" />} hint="Influencers managed" />
              </Link>
              <Link href="/social/messages">
                <StatCard title="Messages" value={stats.messages.toString()} icon={<MessageSquare className="h-5 w-5" />} hint="Inbound / Outbound" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <Link href="/social/accounts" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Accounts</h3>
                <p className="text-sm text-muted-foreground">Add and authenticate social media profiles</p>
              </Link>
              <Link href="/social/posts" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Posts</h3>
                <p className="text-sm text-muted-foreground">Schedule text, image, and video posts</p>
              </Link>
              <Link href="/social/creators" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Creators</h3>
                <p className="text-sm text-muted-foreground">Manage influencer relationships and rates</p>
              </Link>
              <Link href="/social/messages" className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <h3 className="font-semibold mb-2">Messages</h3>
                <p className="text-sm text-muted-foreground">Respond to social comments and direct messages</p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
