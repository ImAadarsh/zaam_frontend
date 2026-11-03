'use client';
import Link from 'next/link';
import { Shield, Users, KeySquare, FileClock, LayoutDashboard, LogOut, X, ArrowLeftRight, User, Building2, Package2, Tag, DollarSign, Receipt, Package, Share2, FileText, Image as ImageIcon, Warehouse, Boxes, ShoppingCart, Truck, PackageSearch, ClipboardList, ArrowRightLeft, TrendingUp, RotateCcw, Landmark, BookOpen, Coins, Calendar, FileText as FileTextIcon, Wallet, CreditCard, FileCheck, BarChart, Clock, Briefcase, CheckSquare, MessageSquare, Star, Megaphone, Percent, BarChart3, CalendarClock, Download, MapPin, Settings, Upload, Globe, FileSpreadsheet, Store, PenLine, Inbox, LineChart, AtSign, Target, Columns3, PhoneCall, Plug, Mail, FolderKanban, Flag, ShieldCheck, PiggyBank, UserCheck, History, Paperclip, Calculator, Banknote, Building, Bell, LayoutGrid, FolderTree } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '@/lib/auth';
import { useSession } from '@/hooks/use-session';
import { useUI } from '@/lib/ui';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { allowedPagesFromSession, canAccessPath, type AllowedPages } from '@/lib/page-access';
import { isChannelsPath, isInventoryOwnedCatalogPath } from '@/lib/nav-module-slugs';

// Role page permissions for the rendered nav; null = unrestricted.
const AllowedPagesContext = createContext<AllowedPages>(null);

type NavCtx = {
  pathname: string | null;
  hasRole: (roles: string[]) => boolean;
};

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-2 flex items-center gap-2 px-3">
      <div className="h-2 w-2 rounded-full bg-[#D4A017] animate-pulse" />
      <div className="text-[10px] uppercase tracking-widest font-semibold text-white/40">{label}</div>
    </div>
  );
}

function NavSubHeader({ label }: { label: string }) {
  return (
    <div className="mt-5 mb-1.5 px-3 flex items-center gap-2 select-none">
      <span className="text-[10px] uppercase font-semibold tracking-wider text-white/40">{label}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function ModuleNavSections({ pathname, hasRole }: NavCtx) {
  const root = (pathname || '/').split('/')[1] || '';
  const onChannels = isChannelsPath(pathname);
  const onInventoryExtra = isInventoryOwnedCatalogPath(pathname);
  const isIAM = root === 'iam';
  const isCatalog = root === 'catalog' && !onChannels && !onInventoryExtra;
  const isChannels = onChannels;
  const isInventory = root === 'inventory' || onInventoryExtra;
  const isOrders = root === 'orders' && !onChannels;
  const isB2b = root === 'b2b';
  const isFinance = root === 'finance';
  const isHR = root === 'hr';
  const isCRM = root === 'crm';
  const isProjects = root === 'projects';
  const isAccounting = root === 'accounting';
  const isMarketing = pathname?.startsWith('/marketing');
  const isSocial = pathname?.startsWith('/social');
  const isAnalytics = pathname?.startsWith('/analytics');
  const isFulfillment = pathname?.startsWith('/fulfillment');
  const isSystem = pathname?.startsWith('/system');

  return (
    <>
      <Item href="/dashboard" icon={<LayoutDashboard size={20} />} label="Global Dashboard" active={pathname === '/dashboard'} />
      {isIAM && (
        <>
          <SectionHeader label="Identity & Access" />
          <Item href="/iam/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/iam/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN']) && (
            <>
              <Item href="/iam/organizations" icon={<Building2 size={18} />} label="Organizations" active={pathname?.startsWith('/iam/organizations')} />
              <Item href="/iam/users" icon={<Users size={18} />} label="Users" active={pathname?.startsWith('/iam/users')} />
              <Item href="/iam/roles" icon={<Shield size={18} />} label="Roles" active={pathname?.startsWith('/iam/roles')} />
              <Item href="/iam/audit-logs" icon={<FileClock size={18} />} label="Audit Logs" active={pathname?.startsWith('/iam/audit-logs')} />
            </>
          )}
          {hasRole(['SUPER_ADMIN']) && (
            <Item href="/iam/api-keys" icon={<KeySquare size={18} />} label="API Keys" active={pathname?.startsWith('/iam/api-keys')} />
          )}
        </>
      )}
      {isCatalog && (
        <>
          <SectionHeader label="Product & Catalog" />
          <Item href="/catalog/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/catalog/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALES_REP']) && (
            <>
              <Item href="/catalog/items" icon={<Package2 size={18} />} label="Catalog item" active={pathname?.startsWith('/catalog/items')} />
              <Item href="/catalog/variants" icon={<Tag size={18} />} label="Variant(s)" active={pathname?.startsWith('/catalog/variants')} />
              <Item href="/catalog/classifications" icon={<FolderTree size={18} />} label="Classification(s)" active={pathname?.startsWith('/catalog/classifications')} />
              <Item href="/catalog/product-media" icon={<ImageIcon size={18} />} label="Product media" active={pathname?.startsWith('/catalog/product-media')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'FINANCE']) && (
            <Item href="/catalog/price-lists" icon={<DollarSign size={18} />} label="Price list(s)" active={pathname?.startsWith('/catalog/price-lists')} />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'FINANCE']) && (
            <Item href="/catalog/tax-codes" icon={<Receipt size={18} />} label="Tax codes" active={pathname?.startsWith('/catalog/tax-codes')} />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']) && (
            <Item href="/catalog/compliance-documents" icon={<FileText size={18} />} label="Compliance document(s)" active={pathname?.startsWith('/catalog/compliance-documents')} />
          )}
        </>
      )}
      {isChannels && (
        <>
          <SectionHeader label="Channels & Integrations" />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALES_REP']) && (
            <>
              <Item href="/channels/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/channels/dashboard'} />
              <Item href="/catalog/channel-mappings" icon={<Share2 size={18} />} label="Channel Mappings" active={pathname?.startsWith('/catalog/channel-mappings')} />
              <Item href="/catalog/import-channels" icon={<Upload size={18} />} label="Import Channels" active={pathname?.startsWith('/catalog/import-channels')} />
              <Item href="/catalog/wordpress-channels" icon={<Globe size={18} />} label="WordPress Channels" active={pathname?.startsWith('/catalog/wordpress-channels')} />
              <Item href="/catalog/epos-channels" icon={<ShoppingCart size={18} />} label="EPOS / GoodTill" active={pathname?.startsWith('/catalog/epos-channels')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN']) && (
            <Item href="/orders/channel-sync" icon={<Download size={18} />} label="Order Channel Sync" active={pathname?.startsWith('/orders/channel-sync')} />
          )}
        </>
      )}
      {isInventory && (
        <>
          <SectionHeader label="Inventory" />
          <Item href="/inventory/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/inventory/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']) && (
            <>
              <Item href="/inventory/warehouses" icon={<Warehouse size={18} />} label="Warehouses" active={pathname?.startsWith('/inventory/warehouses')} />
              <Item href="/inventory/bins" icon={<Boxes size={18} />} label="Bins" active={pathname?.startsWith('/inventory/bins')} />
              <Item href="/inventory/stock-items" icon={<Package2 size={18} />} label="Stock Items" active={pathname?.startsWith('/inventory/stock-items')} />
              <Item href="/catalog/inventory-import" icon={<FileSpreadsheet size={18} />} label="Inventory Import" active={pathname?.startsWith('/catalog/inventory-import')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PURCHASING']) && (
            <>
              <Item href="/inventory/suppliers" icon={<ShoppingCart size={18} />} label="Suppliers" active={pathname?.startsWith('/inventory/suppliers')} />
              <Item href="/inventory/purchase-orders" icon={<Truck size={18} />} label="Purchase Orders" active={pathname?.startsWith('/inventory/purchase-orders')} />
              <Item href="/inventory/asn" icon={<PackageSearch size={18} />} label="ASN" active={pathname?.startsWith('/inventory/asn')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']) && (
            <>
              <Item href="/inventory/grn" icon={<Receipt size={18} />} label="GRN" active={pathname?.startsWith('/inventory/grn')} />
              <Item href="/inventory/stock-transfers" icon={<ArrowRightLeft size={18} />} label="Stock Transfers" active={pathname?.startsWith('/inventory/stock-transfers')} />
              {/* Soft-hidden for now: Stock Adjustments + Cycle Counts remain reachable by direct URL */}
            </>
          )}
        </>
      )}
      {isOrders && (
        <>
          <SectionHeader label="Orders & Customers" />
          <Item href="/orders/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/orders/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE']) && (
            <Item href="/orders/customers" icon={<Users size={18} />} label="Customers" active={pathname?.startsWith('/orders/customers')} />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE', 'WAREHOUSE_MANAGER']) && (
            <Item href="/orders/orders" icon={<ShoppingCart size={18} />} label="Orders" active={pathname?.startsWith('/orders/orders')} />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'CUSTOMER_SERVICE']) && (
            <Item href="/orders/returns" icon={<RotateCcw size={18} />} label="Returns" active={pathname?.startsWith('/orders/returns')} />
          )}
        </>
      )}
      {isB2b && (
        <>
          <SectionHeader label="B2B Sale Channel" />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'SALES_REP', 'B2B_M']) && (
            <>
              <Item href="/b2b/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/b2b/dashboard'} />
              <Item href="/b2b/products" icon={<Package2 size={18} />} label="Products" active={pathname?.startsWith('/b2b/products')} />
              <Item href="/b2b/retailers" icon={<Store size={18} />} label="Retailers" active={pathname?.startsWith('/b2b/retailers')} />
              <Item href="/b2b/orders" icon={<ShoppingCart size={18} />} label="Orders" active={pathname?.startsWith('/b2b/orders')} />
              <Item href="/b2b/shipments" icon={<Truck size={18} />} label="Shipments" active={pathname?.startsWith('/b2b/shipments')} />
              <Item href="/b2b/shipping-methods" icon={<Truck size={18} />} label="Shipping Methods" active={pathname?.startsWith('/b2b/shipping-methods')} />
              <Item href="/b2b/credit" icon={<DollarSign size={18} />} label="Credit" active={pathname === '/b2b/credit' || pathname?.startsWith('/b2b/credit/')} />
              <Item href="/marketing/affiliates?channel=b2b" icon={<Share2 size={18} />} label="Affiliates & Referrals" active={pathname?.startsWith('/marketing/affiliates')} />
              <Item href="/b2b/notifications" icon={<Bell size={18} />} label="Alerts & Promos" active={pathname?.startsWith('/b2b/notifications')} />
              <Item href="/b2b/popular-categories" icon={<LayoutGrid size={18} />} label="Popular Categories" active={pathname?.startsWith('/b2b/popular-categories')} />
              <Item href="/b2b/pricing" icon={<DollarSign size={18} />} label="Pricing" active={pathname?.startsWith('/b2b/pricing')} />
              <Item href="/b2b/settings" icon={<Settings size={18} />} label="Settings" active={pathname?.startsWith('/b2b/settings')} />
            </>
          )}
        </>
      )}
      {isFinance && (
        <>
          <SectionHeader label="Payments & Invoicing" />
          <Item href="/finance/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/finance/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'FINANCE']) && (
            <>
              <NavSubHeader label="Invoicing & Billing" />
              <Item href="/finance/invoices" icon={<Receipt size={18} />} label="Invoices" active={pathname?.startsWith('/finance/invoices')} />

              <NavSubHeader label="Payment Processing" />
              <Item href="/finance/payment-dashboard" icon={<CreditCard size={18} />} label="Payment Dashboard" active={pathname?.startsWith('/finance/payment-dashboard')} />
              <Item href="/finance/payments" icon={<CreditCard size={18} />} label="Payments" active={pathname === '/finance/payments' || pathname?.startsWith('/finance/payments/')} />
              <Item href="/finance/gateways" icon={<Wallet size={18} />} label="Payment Gateways" active={pathname?.startsWith('/finance/gateways')} />

              <NavSubHeader label="Banking & Cash Flow" />
              <Item href="/finance/bank-accounts" icon={<Wallet size={18} />} label="Bank Accounts" active={pathname?.startsWith('/finance/bank-accounts')} />
              <Item href="/finance/bank-transactions" icon={<CreditCard size={18} />} label="Bank Transactions" active={pathname?.startsWith('/finance/bank-transactions')} />

              <NavSubHeader label="General Ledger (ERP)" />
              <Item href="/finance/chart-of-accounts" icon={<BookOpen size={18} />} label="Chart of Accounts" active={pathname?.startsWith('/finance/chart-of-accounts')} />
              <Item href="/finance/ledger-accounts" icon={<FileTextIcon size={18} />} label="Ledger Accounts" active={pathname?.startsWith('/finance/ledger-accounts')} />
              <Item href="/finance/journal-entries" icon={<FileCheck size={18} />} label="Journal Entries" active={pathname?.startsWith('/finance/journal-entries')} />
              <Item href="/finance/fiscal-periods" icon={<Calendar size={18} />} label="Fiscal Periods" active={pathname?.startsWith('/finance/fiscal-periods')} />
              <Item href="/finance/cost-centers" icon={<Coins size={18} />} label="Cost Centers" active={pathname?.startsWith('/finance/cost-centers')} />
              <Item href="/finance/budget-lines" icon={<BarChart size={18} />} label="Budget Lines" active={pathname?.startsWith('/finance/budget-lines')} />

              <NavSubHeader label="Filing & Compliance" />
              <Item href="/finance/vat-returns" icon={<Receipt size={18} />} label="VAT Returns" active={pathname?.startsWith('/finance/vat-returns')} />
            </>
          )}
        </>
      )}
      {isAccounting && (
        <>
          <SectionHeader label="Finance & Accounting" />
          <Item href="/accounting/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" active={pathname === '/accounting/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'ACCOUNTANT']) && (
            <>
              <NavSubHeader label="Core Bookkeeping" />
              <Item href="/accounting/ledger" icon={<BookOpen size={18} />} label="General Ledger & Journals" active={pathname?.startsWith('/accounting/ledger') || pathname?.startsWith('/accounting/chart-of-accounts') || pathname?.startsWith('/accounting/journal-entries') || pathname?.startsWith('/accounting/general-ledger') || pathname?.startsWith('/accounting/trial-balance')} />
              <Item href="/accounting/banking" icon={<Landmark size={18} />} label="Banking & Reconciliation" active={pathname?.startsWith('/accounting/banking') || pathname?.startsWith('/accounting/bank-accounts')} />

              <NavSubHeader label="Sales & Purchases (AP/AR)" />
              <Item href="/accounting/sales" icon={<Receipt size={18} />} label="Sales Invoices" active={pathname?.startsWith('/accounting/sales')} />
              <Item href="/accounting/purchases" icon={<ShoppingCart size={18} />} label="Purchases & Bills" active={pathname?.startsWith('/accounting/purchases')} />
              <Item href="/accounting/expenses" icon={<Wallet size={18} />} label="Expenses" active={pathname?.startsWith('/accounting/expenses')} />

              <NavSubHeader label="Tax & Assets" />
              <Item href="/accounting/vat" icon={<Percent size={18} />} label="VAT (MTD Return)" active={pathname?.startsWith('/accounting/vat')} />
              <Item href="/accounting/tax" icon={<Calculator size={18} />} label="Corporation Tax" active={pathname?.startsWith('/accounting/tax')} />
              <Item href="/accounting/fixed-assets" icon={<Building size={18} />} label="Fixed Assets" active={pathname?.startsWith('/accounting/fixed-assets')} />

              <NavSubHeader label="Workforce & Labor" />
              <Item href="/accounting/payroll" icon={<Banknote size={18} />} label="Payroll Ledger Posting" active={pathname?.startsWith('/accounting/payroll')} />

              <NavSubHeader label="Reports & Governance" />
              <Item href="/accounting/reporting" icon={<BarChart3 size={18} />} label="Financial Reporting (P&L)" active={pathname?.startsWith('/accounting/reporting')} />
              <Item href="/accounting/documents" icon={<Paperclip size={18} />} label="Receipts & Documents" active={pathname?.startsWith('/accounting/documents')} />
              <Item href="/accounting/audit-trail" icon={<History size={18} />} label="Audit Trail" active={pathname?.startsWith('/accounting/audit-trail')} />
              <Item href="/accounting/settings" icon={<Settings size={18} />} label="Accounting Settings" active={pathname?.startsWith('/accounting/settings')} />
            </>
          )}
        </>
      )}
      {isHR && (
        <>
          <SectionHeader label="HR & Payroll" />
          <Item href="/hr/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" active={pathname === '/hr/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']) && (
            <>
              <NavSubHeader label="People & Talent" />
              <Item href="/hr/employees" icon={<Users size={18} />} label="Employees" active={pathname?.startsWith('/hr/employees')} />
              <Item href="/hr/recruitment" icon={<Briefcase size={18} />} label="Recruitment & Hiring" active={pathname?.startsWith('/hr/recruitment')} />
              <Item href="/hr/onboarding" icon={<ClipboardList size={18} />} label="Onboarding" active={pathname?.startsWith('/hr/onboarding')} />
              <Item href="/hr/documents" icon={<FileTextIcon size={18} />} label="Documents" active={pathname?.startsWith('/hr/documents')} />

              <NavSubHeader label="Time & Attendance" />
              <Item href="/hr/attendance" icon={<Clock size={18} />} label="Attendance & Clocking" active={pathname?.startsWith('/hr/attendance') || pathname?.startsWith('/hr/time-entries')} />
              <Item href="/hr/leave" icon={<Calendar size={18} />} label="Leave & Absence" active={pathname?.startsWith('/hr/leave')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'HR_MANAGER', 'HR_ADMIN']) && (
            <>
              <NavSubHeader label="Payroll & Pension" />
              <Item href="/hr/payroll" icon={<DollarSign size={18} />} label="Payroll Runs & Slips" active={pathname?.startsWith('/hr/payroll') || pathname?.startsWith('/hr/payroll-runs')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']) && (
            <Item href="/hr/pension" icon={<PiggyBank size={18} />} label="Workplace Pension" active={pathname?.startsWith('/hr/pension')} />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN', 'FINANCE']) && (
            <NavSubHeader label="Compliance & Reports" />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN']) && (
            <Item href="/hr/immigration" icon={<ShieldCheck size={18} />} label="Immigration & RTW" active={pathname?.startsWith('/hr/immigration')} />
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_ADMIN', 'FINANCE']) && (
            <Item href="/hr/reports" icon={<BarChart3 size={18} />} label="Reports & Analytics" active={pathname?.startsWith('/hr/reports')} />
          )}
          <NavSubHeader label="Employee Portal" />
          <Item href="/hr/self-service" icon={<UserCheck size={18} />} label="Self-Service Portal" active={pathname?.startsWith('/hr/self-service')} />
        </>
      )}
      {isAnalytics && (
        <>
          <SectionHeader label="Analytics & Reporting" />
          <Item href="/analytics/dashboard" icon={<BarChart3 size={18} />} label="Overview" active={pathname === '/analytics/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'FINANCE']) && (
            <>
              <Item href="/analytics/reports" icon={<FileText size={18} />} label="Reports" active={pathname?.startsWith('/analytics/reports')} />
              <Item href="/analytics/scheduled-reports" icon={<CalendarClock size={18} />} label="Scheduled" active={pathname?.startsWith('/analytics/scheduled-reports')} />
              <Item href="/analytics/exports" icon={<Download size={18} />} label="Data Exports" active={pathname?.startsWith('/analytics/exports')} />
            </>
          )}
        </>
      )}
      {isFulfillment && (
        <>
          <SectionHeader label="Fulfillment & 3PL" />
          <Item href="/fulfillment/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/fulfillment/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_MANAGER']) && (
            <>
              <Item href="/fulfillment/pick-pack" icon={<Package size={18} />} label="Pick/Pack" active={pathname?.startsWith('/fulfillment/pick-pack')} />
              <Item href="/fulfillment/shipments" icon={<Truck size={18} />} label="Shipments" active={pathname?.startsWith('/fulfillment/shipments')} />
              <Item href="/fulfillment/tracking" icon={<MapPin size={18} />} label="Tracking" active={pathname?.startsWith('/fulfillment/tracking')} />
            </>
          )}
        </>
      )}
      {isSystem && (
        <>
          <SectionHeader label="System & Config" />
          <Item href="/system/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/system/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN']) && (
            <>
              <Item href="/system/settings" icon={<Settings size={18} />} label="Settings" active={pathname?.startsWith('/system/settings')} />
              <Item href="/system/templates" icon={<FileText size={18} />} label="Templates" active={pathname?.startsWith('/system/templates')} />
              <Item href="/system/webhooks" icon={<Share2 size={18} />} label="Webhooks" active={pathname?.startsWith('/system/webhooks')} />
            </>
          )}
        </>
      )}
      {isCRM && (
        <>
          <SectionHeader label="CRM & Customer Service" />
          <Item href="/crm/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/crm/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'CS_AGENT', 'SALES_REP', 'CUSTOMER_SERVICE']) && (
            <>
              <NavSubHeader label="Sales & Pipeline" />
              <Item href="/crm/accounts" icon={<Building2 size={18} />} label="Accounts" active={pathname?.startsWith('/crm/accounts')} />
              <Item href="/crm/leads" icon={<Target size={18} />} label="Leads" active={pathname?.startsWith('/crm/leads')} />
              <Item href="/crm/pipeline" icon={<Columns3 size={18} />} label="Pipeline" active={pathname?.startsWith('/crm/pipeline') || pathname?.startsWith('/crm/deals')} />
              <Item href="/crm/forecast" icon={<TrendingUp size={18} />} label="Forecast" active={pathname?.startsWith('/crm/forecast')} />
              <Item href="/crm/activities" icon={<PhoneCall size={18} />} label="Activities" active={pathname?.startsWith('/crm/activities')} />
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'CS_AGENT', 'CUSTOMER_SERVICE', 'SALES_REP']) && (
            <>
              <NavSubHeader label="Customer Service" />
              <Item href="/crm/tickets" icon={<MessageSquare size={18} />} label="Tickets" active={pathname?.startsWith('/crm/tickets')} />
              {hasRole(['ADMIN', 'SUPER_ADMIN', 'CS_AGENT', 'CUSTOMER_SERVICE']) && (
                <Item href="/crm/canned-responses" icon={<FileText size={18} />} label="Canned Responses" active={pathname?.startsWith('/crm/canned-responses')} />
              )}
            </>
          )}
          {hasRole(['ADMIN', 'SUPER_ADMIN']) && (
            <>
              <NavSubHeader label="Settings & Configuration" />
              {/* Soft-hidden: Customer Tiers page remains intact & reachable by direct URL */}
              <Item href="/crm/integrations" icon={<Plug size={18} />} label="Integrations" active={pathname?.startsWith('/crm/integrations')} />
              <Item href="/crm/settings/pipelines" icon={<Settings size={18} />} label="Settings" active={pathname?.startsWith('/crm/settings')} />
            </>
          )}
        </>
      )}
      {isProjects && (
        <>
          <SectionHeader label="Project Management" />
          <Item href="/projects/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" active={pathname === '/projects/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER']) && (
            <>
              <Item href="/projects/projects" icon={<FolderKanban size={18} />} label="Projects" active={pathname?.startsWith('/projects/projects')} />
              <Item href="/projects/work-orders" icon={<ClipboardList size={18} />} label="Work Orders" active={pathname?.startsWith('/projects/work-orders')} />
              <Item href="/projects/tasks" icon={<CheckSquare size={18} />} label="Tasks" active={pathname?.startsWith('/projects/tasks')} />
              <Item href="/projects/schedule" icon={<Calendar size={18} />} label="Schedule" active={pathname?.startsWith('/projects/schedule')} />
              <Item href="/projects/milestones" icon={<Flag size={18} />} label="Milestones" active={pathname?.startsWith('/projects/milestones')} />
            </>
          )}
        </>
      )}
      {isMarketing && (
        <>
          <SectionHeader label="Marketing & Affiliates" />
          <Item href="/marketing/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/marketing/dashboard'} />
          {hasRole(['ADMIN', 'SUPER_ADMIN', 'MARKETING']) && (
            <>
              <Item href="/marketing/segments" icon={<Users size={18} />} label="Segments" active={pathname?.startsWith('/marketing/segments')} />
              <Item href="/marketing/email-connectors" icon={<Plug size={18} />} label="Email Connectors" active={pathname?.startsWith('/marketing/email-connectors')} />
              <Item href="/marketing/email-campaigns" icon={<Mail size={18} />} label="Email Campaigns" active={pathname?.startsWith('/marketing/email-campaigns')} />
              <Item href="/marketing/campaigns" icon={<Megaphone size={18} />} label="Campaigns" active={pathname?.startsWith('/marketing/campaigns')} />
              <Item href="/marketing/coupons" icon={<Tag size={18} />} label="Coupons" active={pathname?.startsWith('/marketing/coupons')} />
              <Item href="/marketing/affiliates" icon={<Share2 size={18} />} label="Affiliates" active={pathname?.startsWith('/marketing/affiliates')} />
            </>
          )}
        </>
      )}
      {isSocial && <SocialNav pathname={pathname} />}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useUI();
  const { session, hydrated } = useSession();
  const userRoles = session?.user?.roles || [];
  const allowedPages = useMemo(() => (hydrated ? allowedPagesFromSession(session) : null), [hydrated, session]);

  const hasRole = (requiredRoles: string[]) => {
    if (!hydrated) return false;
    const roleCodes = userRoles.map((r: any) => typeof r === 'string' ? r : (r?.code || r?.name || '')).map((r: string) => r.toUpperCase());
    if (roleCodes.includes('SUPER_ADMIN') || requiredRoles.some(role => roleCodes.includes(role.toUpperCase()))) {
      return true;
    }
    // Custom / IAM page grants: open the role gate; each <Item> still filters via canAccessPath.
    const pages = session?.user?.pages;
    if (pages === null) return true;
    return Array.isArray(pages) && pages.length > 0;
  };

  function doLogout() {
    clearSession();
    router.replace('/login');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') toggleSidebar(false);
    }
    document.addEventListener('keydown', onKey);
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
        document.removeEventListener('keydown', onKey);
      };
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen, toggleSidebar]);

  useEffect(() => {
    toggleSidebar(false);
  }, [pathname, toggleSidebar]);

  const nav = <ModuleNavSections pathname={pathname} hasRole={hasRole} />;

  return (
    <AllowedPagesContext.Provider value={allowedPages}>
      {/* Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[280px] bg-[#0f0f0f]/95 backdrop-blur-2xl text-white p-5 border-r border-white/5 flex-col shadow-[4px_0_24px_rgba(0,0,0,0.4)] z-50">
        <div className="flex items-center gap-3 px-2 mb-6 mt-2">
          <div className="relative h-8 w-32">
            <Image src="/brand/h-golden.png" alt="Zaam" fill className="object-contain object-left" />
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 mb-4" />
        <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1 scrollbar-none">
          {nav}
        </nav>
        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
          <Link
            href="/profile"
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <User size={18} className="group-hover:text-primary transition-colors" />
            <span className="font-medium text-sm">Profile</span>
          </Link>
          <Link
            href="/modules"
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <ArrowLeftRight size={18} className="group-hover:text-primary transition-colors" />
            <span className="font-medium text-sm">Switch Module</span>
          </Link>
          <button
            onClick={doLogout}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>
      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => toggleSidebar(false)} />
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-[#0f0f0f] text-white p-5 border-r border-white/10 flex-col shadow-2xl animate-slide-in flex">
            <div className="flex items-center justify-between px-1 mb-6">
              <div className="relative h-8 w-32">
                <Image src="/brand/h-golden.png" alt="Zaam" fill className="object-contain object-left" />
              </div>
              <button aria-label="Close menu" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition" onClick={() => toggleSidebar(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="h-px bg-white/10 mx-2 mb-4" />
            <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              {nav}
            </nav>
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <Link
                href="/profile"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <User size={18} />
                <span className="font-medium">Profile</span>
              </Link>
              <Link
                href="/modules"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <ArrowLeftRight size={18} />
                <span className="font-medium">Switch Module</span>
              </Link>
              <button
                onClick={() => { toggleSidebar(false); doLogout(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <LogOut size={18} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </AllowedPagesContext.Provider>
  );
}

function SocialNav({ pathname }: { pathname: string | null }) {
  return (
    <>
      <SectionHeader label="Social Media" />
      <Item href="/social/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/social/dashboard'} />
      <Item href="/social/compose" icon={<PenLine size={18} />} label="Composer" active={pathname?.startsWith('/social/compose')} />
      <Item href="/social/posts" icon={<Share2 size={18} />} label="Posts" active={pathname?.startsWith('/social/posts')} />
      <Item href="/social/messages" icon={<Inbox size={18} />} label="Inbox" active={pathname?.startsWith('/social/messages')} />
      <Item href="/social/ads" icon={<Megaphone size={18} />} label="Ads" active={pathname?.startsWith('/social/ads')} />
      <Item href="/social/insights" icon={<LineChart size={18} />} label="Insights" active={pathname?.startsWith('/social/insights')} />
      <Item href="/social/accounts" icon={<AtSign size={18} />} label="Accounts" active={pathname?.startsWith('/social/accounts')} />
      <Item href="/social/creators" icon={<Users size={18} />} label="Creators" active={pathname?.startsWith('/social/creators')} />
    </>
  );
}

function Item({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  const allowedPages = useContext(AllowedPagesContext);
  if (!canAccessPath(href.split('?')[0], allowedPages)) return null;
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${active
        ? 'bg-gradient-to-r from-zaam-500/20 to-transparent text-zaam-400 shadow-[inset_2px_0_0_0_#D4A017]'
        : 'text-white/60 hover:text-white hover:bg-white/5'
        }`}
    >
      <span className={`transition-colors ${active ? 'text-zaam-500' : 'group-hover:text-white'}`}>{icon}</span>
      <span>{label}</span>
      {active && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-zaam-500/20 pointer-events-none" />
      )}
    </Link>
  );
}
