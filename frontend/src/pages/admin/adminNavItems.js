import { LayoutDashboard, Users, Store, Tag, ShoppingBag, Monitor, Ticket, BarChart3, DollarSign, Wallet, Package, Gift, CreditCard, UserCog, RotateCcw, Barcode, TrendingUp, Brain, Clock, Target } from 'lucide-react';

const adminNavItems = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/employees', label: 'Employees', icon: UserCog },
  { path: '/admin/targets', label: 'Targets', icon: Target },
  { path: '/admin/attendance', label: 'Attendance', icon: Clock },
  { path: '/admin/leaves', label: 'Leaves', icon: Clock },
  { path: '/admin/stores', label: 'Stores', icon: Store },
  { path: '/admin/categories', label: 'Categories', icon: Tag },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/admin/returns', label: 'Returns', icon: RotateCcw },
  { path: '/admin/barcodes', label: 'Barcodes', icon: Barcode },
  { path: '/admin/vouchers', label: 'Vouchers', icon: Ticket },
  { path: '/admin/promotions', label: 'Promotions', icon: Gift },
  { path: '/admin/expenses', label: 'Expenses & Income', icon: Wallet },
  { path: '/admin/financials', label: 'Financials', icon: DollarSign },
  { path: '/admin/payroll', label: 'Payroll', icon: CreditCard },
  { path: '/admin/overtime', label: 'Overtime Pay', icon: Clock },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/supplier-payments', label: 'Supplier Payments', icon: Wallet },
  { path: '/admin/sales-tracking', label: 'Sales Tracking', icon: TrendingUp },
  { path: '/admin/predictions', label: 'AI Predictions', icon: Brain },
  { path: '/admin/settings', label: 'Settings', icon: LayoutDashboard },
  { path: '/barcode-generator', label: 'Barcode Generator', icon: Barcode },
  { path: '/pos', label: 'POS Terminal', icon: Monitor },
];

export default adminNavItems;
