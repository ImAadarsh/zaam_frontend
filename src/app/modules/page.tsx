'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ModuleCard } from '@/components/module-card';
import { modules } from '@/data/modules';
import { Search } from 'lucide-react';
import Image from 'next/image';

export default function ModulesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const s = getSession();
    if (!s?.accessToken) router.replace('/login');
  }, [router]);

  const filteredModules = modules.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="relative h-8 w-[180px]">
              <Image src="/brand/golden-shine.png" alt="Zaam" fill className="object-contain object-left" />
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Module Hub</span>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold mb-2 text-foreground tracking-tight">
              Welcome to Zaam
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your complete business management platform. Select a module below to get started.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Module Grid */}
        {filteredModules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredModules.map((m) => (
              <ModuleCard
                key={m.slug}
                href={`/${m.slug}/dashboard`}
                title={m.name}
                description={m.description}
                Icon={m.icon}
                featured={m.slug === 'iam'}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
              <Search size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No modules found</h3>
            <p className="text-muted-foreground">Try a different search term</p>
          </div>
        )}
      </div>
    </main>
  );
}
