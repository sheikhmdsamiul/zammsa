import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '../../hooks/useAuth';
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

const navItems = [
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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-zammsa-black text-white transform transition-transform lg:translate-x-0 lg:static lg:inset-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 h-16 px-6 border-b border-gray-700">
          <div className="w-8 h-8 bg-zammsa-orange rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="font-bold">Admin Panel</span>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path))
                  ? 'bg-zammsa-orange text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-20">
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-sm text-gray-500">Administrator</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zammsa-orange rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.full_name}</span>
            </div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600 ml-4">
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <React.Suspense fallback={<PageLoader />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
