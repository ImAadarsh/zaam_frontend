'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

/**
 * Promotional prices are not used for this deployment.
 * Route kept so bookmarks/deep links do not 404; feature is hidden from nav.
 */
export default function PromotionalPricesPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Catalog · Promotional Prices" />
        <main className="flex-1 p-6">
          <div className="max-w-lg rounded-xl border border-border bg-card p-8">
            <h1 className="text-xl font-semibold tracking-tight">Promotional prices not used</h1>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              Promotional prices are not part of this catalog workflow. Use Price Lists or Catalog Items instead.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/catalog/price-lists"
                className="inline-flex text-sm font-medium text-primary hover:underline"
              >
                Go to Price Lists
              </Link>
              <Link
                href="/catalog/items"
                className="inline-flex text-sm font-medium text-primary hover:underline"
              >
                Go to Catalog Items
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
