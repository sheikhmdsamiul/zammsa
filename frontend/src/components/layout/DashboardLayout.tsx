import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import {
  ChartBarIcon, CashIcon, ClipboardListIcon,
  PencilIcon, DocumentTextIcon, DocumentDuplicateIcon,
  DocumentIcon, OfficeBuildingIcon, TrendingUpIcon,
} from '@heroicons/react/outline';

const iconClass = 'h-5 w-5';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin h-8 w-8 border-4 border-zammsa-green border-t-transparent rounded-full" />
  </div>
);

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
  { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} />, roles: [ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL] },
  { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} />, roles: [ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.FINANCE_OFFICER, ROLES.DIRECTOR_GENERAL] },
  { label: 'Solicitations', path: '/solicitations', icon: <ClipboardListIcon className={iconClass} />, roles: [ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT] },
  { label: 'Bid Management', path: '/bids', icon: <DocumentTextIcon className={iconClass} />, roles: [ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.EVALUATION_COMMITTEE_MEMBER, ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT] },
  { label: 'Bid Evaluation', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} />, roles: [ROLES.EVALUATION_COMMITTEE_MEMBER, ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT] },
  { label: 'Contracts', path: '/contracts', icon: <DocumentIcon className={iconClass} />, roles: [ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER] },
  { label: 'Finance & Payments', path: '/finance', icon: <CashIcon className={iconClass} />, roles: [ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER] },
  { label: 'Suppliers', path: '/suppliers', icon: <OfficeBuildingIcon className={iconClass} />, roles: [ROLES.SUPPLIER_RELATIONSHIP_MANAGER] },
  { label: 'Reports & Analytics', path: '/reports', icon: <TrendingUpIcon className={iconClass} />, roles: [ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL, ROLES.ZPPA_REPORTING_OFFICER, ROLES.BUDGET_CONTROLLER] },
] as Array<{ label: string; path: string; icon: React.ReactNode; roles?: string[] }>;

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const logout = useLogout();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const normalizedRole = user?.role === 'zppa_reporter' ? 'zppa_reporting_officer' : user?.role;
  const visibleNav = navItems.filter((item) => !item.roles || (normalizedRole && item.roles.includes(normalizedRole)));

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static lg:inset-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 h-16 px-6 border-b border-gray-200">
          <div className="w-8 h-8 bg-zammsa-green rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">Z</span>
          </div>
          <span className="font-bold text-zammsa-green">ZAMMSA</span>
        </div>
        <nav className="mt-4 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {visibleNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname.startsWith(item.path)
                  ? 'bg-zammsa-green text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-20">
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-sm text-gray-500">{user?.department}</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zammsa-green rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-700">{user?.full_name}</p>
                <p className="text-gray-400 text-xs">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
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

export default DashboardLayout;
