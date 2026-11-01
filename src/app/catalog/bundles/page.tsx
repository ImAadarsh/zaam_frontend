'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

/**
 * Bundles are not used for this deployment.
 * Route kept so bookmarks/deep links do not 404; feature is hidden from nav.
 */
export default function BundlesPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Catalog · Bundles" />
        <main className="flex-1 p-6">
          <div className="max-w-lg rounded-xl border border-border bg-card p-8">
            <h1 className="text-xl font-semibold tracking-tight">Bundles not used</h1>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              Product bundles are not part of this catalog workflow. Use Catalog Items and Variants instead.
            </p>
            <Link
              href="/catalog/items"
              className="inline-flex mt-6 text-sm font-medium text-primary hover:underline"
            >
              Go to Catalog Items
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
