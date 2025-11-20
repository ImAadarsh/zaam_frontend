'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { listAuditLogs } from '@/lib/api';
import { toast } from 'sonner';
import { RichDataTable } from '@/components/rich-data-table';
import { useSession } from '@/hooks/use-session';
import { ColumnDef } from '@tanstack/react-table';

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  created_at: string;
  [key: string]: any;
};

export default function AuditLogsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const res = await listAuditLogs(50);
        setItems(res.data);
      } catch {
        toast.error('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, router, session?.accessToken]);

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    {
      accessorKey: 'action',
      header: 'Action',
      cell: (info) => <span className="font-medium text-foreground">{info.getValue() as string}</span>,
    },
    {
      id: 'entity',
      header: 'Entity',
      accessorFn: (row) => row.entity_type ? `${row.entity_type}#${row.entity_id ?? ''}` : '-',
      cell: (info) => <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'user_id',
      header: 'User',
      cell: (info) => info.getValue() || <span className="text-muted-foreground italic">—</span>,
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: (info) => {
        const date = new Date(info.getValue() as string);
        return <span className="text-muted-foreground text-xs">{date.toLocaleString()}</span>;
      },
    },
  ], []);

  if (!hydrated || !session?.accessToken) return null;

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col overflow-hidden lg:ml-[280px]">
        <Header title="IAM · Audit Logs" />
        <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
              <p className="text-muted-foreground">View system activity and security events.</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center rounded-2xl border border-border bg-card/50 animate-pulse">
              Loading logs...
            </div>
          ) : (
            <RichDataTable
              columns={columns}
              data={items}
              searchPlaceholder="Search logs..."
            />
          )}
        </main>
      </div>
    </div>
  );
}
