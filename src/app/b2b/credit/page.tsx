'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { listB2bCreditRequests, reviewB2bCreditRequest } from '@/lib/api';
import { toast } from 'sonner';

export default function B2bCreditPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'B2B_M']);
  const [credits, setCredits] = useState<any[]>([]);
  const orgId = session?.user?.organizationId;

  const load = async () => {
    if (!orgId) return;
    try {
      const c = await listB2bCreditRequests({ organizationId: orgId });
      setCredits(c.data || []);
    } catch {
      toast.error('Failed to load credit data');
    }
  };

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    load();
  }, [hydrated, hasAccess, session?.accessToken, orgId]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="B2B · Credit" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Credit increase requests</h2>
            <RichDataTable
              data={credits}
              columns={[
                { accessorFn: (r: any) => r.customer?.companyName || r.customer?.email, header: 'Retailer' },
                { accessorKey: 'currentLimit', header: 'Current' },
                { accessorKey: 'requestedLimit', header: 'Requested' },
                { accessorKey: 'status', header: 'Status' },
                {
                  header: 'Actions',
                  cell: ({ row }: any) =>
                    row.original.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          className="text-xs px-2 py-1 border rounded"
                          onClick={async () => {
                            await reviewB2bCreditRequest(row.original.id, { organizationId: orgId, status: 'approved' });
                            toast.success('Approved');
                            load();
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="text-xs px-2 py-1 border rounded"
                          onClick={async () => {
                            await reviewB2bCreditRequest(row.original.id, { organizationId: orgId, status: 'rejected' });
                            toast.success('Rejected');
                            load();
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null
                }
              ] as any}
              searchPlaceholder="Search credit requests..."
            />
          </section>
        </main>
      </div>
    </div>
  );
}
