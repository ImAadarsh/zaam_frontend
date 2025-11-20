'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    const s = getSession();
    if (!s?.accessToken) router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen app-surface">
      <Sidebar />
      <div className="flex flex-col min-w-0 lg:ml-[280px]">
        <Header title="Dashboard" />
        <main className="p-6 md:p-8 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value="£42,593.00"
            trend="+12.5%"
            trendUp={true}
            icon={<DollarSign size={20} />}
            delay={0}
          />
          <StatCard
            label="Orders"
            value="1,240"
            trend="+4.3%"
            trendUp={true}
            icon={<ShoppingBag size={20} />}
            delay={100}
          />
          <StatCard
            label="Active Users"
            value="843"
            trend="+8.1%"
            trendUp={true}
            icon={<Users size={20} />}
            delay={200}
          />
          <StatCard
            label="Pending Support"
            value="12"
            trend="-2.4%"
            trendUp={false} // Good for support tickets to be down? Or maybe trendUp means "increase". Let's say decrease is good.
            icon={<MessageSquare size={20} />}
            delay={300}
          />
        </main>
      </div>
    </div>
  );
}

import { DollarSign, ShoppingBag, Users, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';

function StatCard({ label, value, trend, trendUp, icon, delay }: any) {
  return (
    <div
      className="relative group animate-scale-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative h-full p-6 rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Content */}
        <div className="relative space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
            <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors duration-300">
              <div className="text-muted-foreground group-hover:text-primary transition-colors duration-300">
                {icon}
              </div>
            </div>
          </div>

          {/* Value */}
          <div>
            <div className="text-3xl font-bold text-foreground tracking-tight">
              {value}
            </div>
          </div>

          {/* Trend */}
          <div className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${trendUp
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
              {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{trend}</span>
            </div>
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ${trendUp ? 'bg-emerald-500' : 'bg-rose-500'
          }`} />
      </div>
    </div>
  );
}


