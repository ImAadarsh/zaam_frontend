'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { createApiKey } from '@/lib/api';
import { toast } from 'sonner';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';

export default function ApiKeysPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['SUPER_ADMIN']);
  const [created, setCreated] = useState<{ name: string; key: string; keyPrefix: string } | null>(null);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) router.replace('/login');
  }, [hydrated, hasAccess, router, session?.accessToken]);

  async function onCreate() {
    if (!session) return;
    try {
      const res = await createApiKey({ organizationId: session.user.organizationId, name: 'Admin Token' });
      setCreated(res.data);
      await navigator.clipboard.writeText(res.data.key);
      toast.success('API key created and copied to clipboard');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Failed to create API key');
    }
  }

  if (!hydrated || !hasAccess || !session?.accessToken) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col lg:ml-[280px]">
        <Header title="IAM · API Keys" />
        <main className="p-4 md:p-6 space-y-4">
          <button className="btn btn-primary h-10 px-4" onClick={onCreate}>Create API Key</button>
          {created && (
            <div className="rounded-2xl border border-zaam-soft bg-[color:var(--card)] p-4 animate-fade-in">
              <div className="text-sm text-zaam-grey mb-2">New Key</div>
              <div className="font-mono break-all text-sm">{created.key}</div>
              <div className="text-xs text-zaam-grey mt-2">Keep this secret. It will not be shown again.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


