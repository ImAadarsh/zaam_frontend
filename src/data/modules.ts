import {
  Shield, Boxes, Package2, ShoppingCart, Truck, Wallet, Landmark,
  Users, Headset, Megaphone, Share2, BarChart3, Settings
} from 'lucide-react';

export const modules = [
  { slug: 'iam', name: 'Identity & Access', icon: Shield, color: '#D4A017',
    description: 'Users, Roles, API Keys, Audit' },
  { slug: 'catalog', name: 'Product & Catalog', icon: Package2, color: '#D4A017',
    description: 'Products, Variants, Pricing, Channels' },
  { slug: 'inventory', name: 'Inventory', icon: Boxes, color: '#0A0A0A',
    description: 'Warehouses, Bins, Stock, ASN/GRN' },
  { slug: 'orders', name: 'Orders & Customers', icon: ShoppingCart, color: '#0A0A0A',
    description: 'Orders, Customers, Returns' },
  { slug: 'fulfillment', name: 'Fulfillment & 3PL', icon: Truck, color: '#0A0A0A',
    description: 'Pick/Pack, Shipments, Tracking' },
  { slug: 'payments', name: 'Payments & Invoicing', icon: Wallet, color: '#0A0A0A',
    description: 'Gateways, Payments, Invoices' },
  { slug: 'finance', name: 'Finance & Accounting', icon: Landmark, color: '#0A0A0A',
    description: 'GL, Journals, VAT, Bank' },
  { slug: 'hr', name: 'HR, Payroll & KPI', icon: Users, color: '#0A0A0A',
    description: 'Employees, Payroll, KPIs' },
  { slug: 'crm', name: 'CRM & Service', icon: Headset, color: '#0A0A0A',
    description: 'Tickets, SLA, Surveys' },
  { slug: 'marketing', name: 'Marketing & Affiliates', icon: Megaphone, color: '#0A0A0A',
    description: 'Campaigns, Coupons, Affiliates' },
  { slug: 'social', name: 'Social Media', icon: Share2, color: '#0A0A0A',
    description: 'Posts, Inbox, Creators' },
  { slug: 'reports', name: 'Reporting & Analytics', icon: BarChart3, color: '#0A0A0A',
    description: 'Reports, Dashboards, Exports' },
  { slug: 'system', name: 'System & Config', icon: Settings, color: '#0A0A0A',
    description: 'Settings, Templates, Webhooks' }
];


