/**
 * Maps Module Hub slugs (`modules.ts`) to sidebar / NAV_MODULES group labels.
 * Page URLs may live under a different path root (e.g. channel pages under /catalog)
 * while still belonging to another hub module for access and IA.
 */
export const MODULE_LABEL_BY_SLUG: Record<string, string> = {
  iam: 'Identity & Access',
  catalog: 'Product & Catalog',
  channels: 'Channels & Integrations',
  inventory: 'Inventory',
  orders: 'Orders & Customers',
  b2b: 'B2B Sale Channel',
  finance: 'Payments & Invoicing',
  accounting: 'Finance & Accounting',
  hr: 'HR & Payroll',
  analytics: 'Analytics & Reporting',
  fulfillment: 'Fulfillment & 3PL',
  system: 'System & Config',
  crm: 'CRM & Customer Service',
  projects: 'Project Management',
  marketing: 'Marketing & Affiliates',
  social: 'Social Media',
};

/** Path prefixes owned by Channels & Integrations (URLs kept under catalog/orders). */
export const CHANNEL_PATH_PREFIXES = [
  '/catalog/channel-mappings',
  '/catalog/import-channels',
  '/catalog/wordpress-channels',
  '/catalog/epos-channels',
  '/orders/channel-sync',
] as const;

/** Paths that live under /catalog but belong in the Inventory module nav. */
export const INVENTORY_EXTRA_PATH_PREFIXES = ['/catalog/inventory-import'] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isChannelsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0];
  if (path === '/channels' || path.startsWith('/channels/')) return true;
  return CHANNEL_PATH_PREFIXES.some((p) => matchesPrefix(path, p));
}

export function isInventoryOwnedCatalogPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0];
  return INVENTORY_EXTRA_PATH_PREFIXES.some((p) => matchesPrefix(path, p));
}
