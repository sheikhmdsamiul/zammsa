import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth, useLogout } from '../../hooks/useAuth';
import Sidebar, { NavItem } from './Sidebar';
import {
  ChartBarIcon, UserGroupIcon, LockClosedIcon, ClipboardListIcon,
  OfficeBuildingIcon, HeartIcon, AdjustmentsIcon, LinkIcon,
  CogIcon, CalendarIcon, TrendingUpIcon, SaveIcon, CubeIcon, CurrencyDollarIcon,
} from '@heroicons/react/outline';

const iconClass = 'h-5 w-5';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin h-8 w-8 border-4 border-zammsa-green border-t-transparent rounded-full" />
  </div>
);

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: <ChartBarIcon className={iconClass} /> },
  { label: 'User Management', path: '/admin/users', icon: <UserGroupIcon className={iconClass} /> },
  { label: 'Role Management', path: '/admin/roles', icon: <LockClosedIcon className={iconClass} /> },
  { label: 'Vendor Applications', path: '/admin/vendor-applications', icon: <ClipboardListIcon className={iconClass} /> },
  { label: 'Vendor Management', path: '/admin/vendors', icon: <OfficeBuildingIcon className={iconClass} /> },
  { label: 'System Health', path: '/admin/system-health', icon: <HeartIcon className={iconClass} /> },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: <ClipboardListIcon className={iconClass} /> },
  { label: 'Governance Settings', path: '/admin/governance', icon: <AdjustmentsIcon className={iconClass} /> },
  { label: 'Integration Monitor', path: '/admin/integrations', icon: <LinkIcon className={iconClass} /> },
  { label: 'System Settings', path: '/admin/settings', icon: <CogIcon className={iconClass} /> },
  { label: 'Departments', path: '/admin/departments', icon: <OfficeBuildingIcon className={iconClass} /> },
  { label: 'Fiscal Years', path: '/admin/fiscal-years', icon: <CalendarIcon className={iconClass} /> },
  { label: 'Commodities', path: '/admin/commodities', icon: <CubeIcon className={iconClass} /> },
  { label: 'Budget Allocations', path: '/admin/budget-allocations', icon: <CurrencyDollarIcon className={iconClass} /> },
  { label: 'Reports', path: '/admin/reports', icon: <TrendingUpIcon className={iconClass} /> },
  { label: 'Backup Management', path: '/admin/backups', icon: <SaveIcon className={iconClass} /> },
];

const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const logout = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarFooter = (
    <div className="space-y-4">
      <Link
        to="/dashboard"
        className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
      >
        <span>←</span>
        Internal Portal
      </Link>
      <div className="flex items-center gap-3 px-2 py-1">
        <div className="w-10 h-10 bg-zammsa-orange rounded-xl flex items-center justify-center shadow-lg shadow-zammsa-orange/20 shrink-0">
          <span className="text-white text-sm font-bold">
            {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{user?.full_name}</p>
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider truncate">Administrator</p>
        </div>
        <button onClick={logout} className="p-2 text-gray-500 hover:text-red-500 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar 
        navItems={navItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        brandName="Admin Panel"
        accentColor="zammsa-orange"
        footer={sidebarFooter}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 h-20 flex items-center justify-between px-8 sticky top-0 z-20">
          <button className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => setSidebarOpen(true)}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-gray-900">System Control</h1>
            <p className="text-xs text-gray-500 font-medium">Administrator Portal</p>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3">
               <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-900 leading-none">{user?.full_name}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">System Admin</p>
               </div>
               <div className="w-10 h-10 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden">
                  <span className="text-zammsa-orange font-bold text-sm">
                    {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
               </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          <React.Suspense fallback={<PageLoader />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
