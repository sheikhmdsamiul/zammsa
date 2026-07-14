import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth, useLogout } from '../../hooks/useAuth';
import { ROLES } from '../../config/rbac';
import Sidebar, { NavItem } from './Sidebar';
import useSidebarBadges from '../../hooks/useSidebarBadges';
import {
  ChartBarIcon, CashIcon, ClipboardListIcon,
  PencilIcon, DocumentTextIcon, DocumentDuplicateIcon,
  DocumentIcon, OfficeBuildingIcon, TrendingUpIcon,
  LockOpenIcon, CheckCircleIcon,
  ClockIcon, ExclamationIcon, StarIcon,
  ShieldCheckIcon, AnnotationIcon, BadgeCheckIcon,
  CalendarIcon
} from '@heroicons/react/outline';
import NotificationBell from '../common/NotificationBell';

const iconClass = 'h-5 w-5';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin h-8 w-8 border-4 border-zammsa-green border-t-transparent rounded-full" />
  </div>
);

/** Maps sub-items to their closest existing route so sidebar navigation never 404s. */
function useSidebarItems(userRole: string | undefined): NavItem[] {
  const role = userRole === 'zppa_reporter' ? 'zppa_reporting_officer' : userRole;
  const badges = useSidebarBadges(role);

  const items: Record<string, NavItem[]> = {
    [ROLES.PROCUREMENT_OFFICER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} />,
        children: [
          { label: 'Annual Plans (APP)', path: '/procurement-planning' },
          { label: 'Contract Plans (CPP)', path: '/procurement-planning/cpp' },
        ]
      },
      { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} />, badge: badges.requisitions || undefined },
      { label: 'Solicitations', path: '/solicitations', icon: <DocumentTextIcon className={iconClass} />, badge: badges.solicitations || undefined,
        children: [
          { label: 'Create New', path: '/solicitations/create' },
          { label: 'All Solicitations', path: '/solicitations' },
        ]
      },
      { label: 'Bid Management', path: '/bids', icon: <LockOpenIcon className={iconClass} />, badge: badges.bids || undefined,
        children: [
          { label: 'Bid Opening List', path: '/bids/opening' },
          { label: 'Opening Setup', path: '/bids/opening/setup' },
          { label: 'Received Bids', path: '/bids' },
          { label: 'Minutes Archive', path: '/bids/opening/minutes' },
          { label: 'Late/Rejected Bids', path: '/bids/late-rejected' },
        ]
      },
      { label: 'Evaluations', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} />, badge: badges.evaluations || undefined,
        children: [
          { label: 'Committee Formation', path: '/evaluations/committee/formation' },
          { label: 'Active Evaluations', path: '/evaluations' },
          { label: 'Post-Qualification', path: '/evaluations/post-qualification' },
        ]
      },
      { label: 'Contract Award', path: '/contracts', icon: <BadgeCheckIcon className={iconClass} />,
        children: [
          { label: 'Award Overview', path: '/contracts/award-overview' },
          { label: 'Award Notices', path: '/contracts/award-notices' },
          { label: 'Standstill Monitor', path: '/contracts' },
          { label: 'Appeals', path: '/contracts/appeals' },
          { label: 'Generate Contract', path: '/contracts/generate' },
          { label: 'Performance Security', path: '/contracts/performance-security' },
        ]
      },
      { label: 'Suppliers', path: '/suppliers', icon: <OfficeBuildingIcon className={iconClass} /> },
      { label: 'Reports', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
    ],
    [ROLES.DIRECTOR_PROCUREMENT]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Approvals', path: '/requisitions', icon: <CheckCircleIcon className={iconClass} />, badge: badges.approvals || undefined },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} />,
        children: [
          { label: 'Annual Plans (APP)', path: '/procurement-planning' },
          { label: 'Contract Plans (CPP)', path: '/procurement-planning/cpp' },
        ]
      },
      { label: 'Solicitations', path: '/solicitations', icon: <DocumentTextIcon className={iconClass} /> },
      { label: 'Bid Evaluation', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} />,
        children: [
          { label: 'Form EC Committee', path: '/evaluations/committee/formation' },
          { label: 'Active Evaluations', path: '/evaluations' },
          { label: 'Post-Qualification', path: '/evaluations/post-qualification' },
          { label: 'BERs Awaiting ZPC', path: '/evaluations/zpc-approval' },
        ]
      },
      { label: 'Contract Award', path: '/contracts', icon: <BadgeCheckIcon className={iconClass} />,
        children: [
          { label: 'Award Overview', path: '/contracts/award-overview' },
          { label: 'Award Notices', path: '/contracts/award-notices' },
          { label: 'Standstill Monitor', path: '/contracts' },
          { label: 'Appeals', path: '/contracts/appeals' },
          { label: 'Generate Contract', path: '/contracts/generate' },
          { label: 'Performance Security', path: '/contracts/performance-security' },
        ]
      },
      { label: 'Compliance', path: '/reports', icon: <ShieldCheckIcon className={iconClass} /> },
      { label: 'Analytics', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
    ],
    [ROLES.EVALUATION_COMMITTEE_MEMBER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'My Evaluations', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} />, badge: badges.evaluations || undefined },
      { label: 'Declarations', path: '/evaluations', icon: <AnnotationIcon className={iconClass} /> },
      { label: 'Bid Documents', path: '/bids', icon: <DocumentTextIcon className={iconClass} /> },
    ],
    [ROLES.EVALUATION_COMMITTEE_CHAIR]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'My Evaluations', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} />, badge: badges.evaluations || undefined },
      { label: 'Declarations', path: '/evaluations', icon: <AnnotationIcon className={iconClass} /> },
      { label: 'Post-Qualification', path: '/evaluations/post-qualification', icon: <ClipboardListIcon className={iconClass} /> },
      { label: 'Bid Documents', path: '/bids', icon: <DocumentTextIcon className={iconClass} /> },
    ],
    [ROLES.ZPC_MEMBER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'ZPC Approvals', path: '/requisitions', icon: <CheckCircleIcon className={iconClass} />, badge: (badges.approvals + badges.cppReviews) || undefined,
        children: [
          { label: 'BERs Pending', path: '/evaluations/zpc-approval' },
          { label: 'APP Reviews', path: '/procurement-planning' },
          { label: 'CPP Non-Open Method', path: '/procurement-planning/cpp', badge: badges.cppReviews || undefined },
          { label: 'Requisitions >K250K', path: '/requisitions' },
          { label: 'Contract Amendments', path: '/contracts' },
        ]
      },
      { label: 'ZPC Meeting', path: '/dashboard', icon: <CalendarIcon className={iconClass} /> },
      { label: 'Approvals History', path: '/requisitions', icon: <ClockIcon className={iconClass} /> },
    ],
    [ROLES.DIRECTOR_GENERAL]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'My Approvals', path: '/requisitions', icon: <CheckCircleIcon className={iconClass} />, badge: badges.approvals || undefined,
        children: [
          { label: 'Requisitions', path: '/requisitions' },
          { label: 'Invoice Payments', path: '/finance/invoices', badge: badges.invoices || undefined },
          { label: 'Contract Signing', path: '/contracts?queue=dg_signature' },
        ]
      },
      { label: 'Executive Overview', path: '/dashboard', icon: <ChartBarIcon className={iconClass} />,
        children: [
          { label: 'Procurement KPIs', path: '/reports' },
          { label: 'Budget Status', path: '/finance/budgets' },
          { label: 'Active Contracts', path: '/contracts' },
          { label: 'Supplier Performance', path: '/contracts' },
        ]
      },
      { label: 'Contracts', path: '/contracts', icon: <DocumentIcon className={iconClass} /> },
      { label: 'Reports', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
    ],
    [ROLES.CONTRACT_MANAGER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'My Contracts', path: '/contracts', icon: <DocumentIcon className={iconClass} />, badge: badges.contracts || undefined },
      { label: 'Signing & Security', path: '/contracts/performance-security', icon: <ShieldCheckIcon className={iconClass} /> },
      { label: 'Milestones', path: '/contracts/milestones', icon: <ClockIcon className={iconClass} />, badge: badges.milestones || undefined },
      { label: 'Amendments', path: '/contracts/amendments', icon: <PencilIcon className={iconClass} /> },
      { label: 'Liquidated Damages', path: '/contracts/liquidated-damages', icon: <ExclamationIcon className={iconClass} /> },
      { label: 'Invoices & Payments', path: '/finance/invoices', icon: <CashIcon className={iconClass} /> },
      { label: 'Supplier Performance', path: '/contracts/supplier-performance', icon: <StarIcon className={iconClass} /> },
      { label: 'Contract Closure', path: '/contracts/closure', icon: <LockOpenIcon className={iconClass} /> },
    ],
    [ROLES.FINANCE_OFFICER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Finance', path: '/finance', icon: <CashIcon className={iconClass} />,
        children: [
          { label: 'Overview', path: '/finance' },
          { label: 'Budgets', path: '/finance/budgets' },
        ]
      },
      { label: 'Invoices', path: '/finance/invoices', icon: <DocumentTextIcon className={iconClass} />, badge: badges.invoices || undefined,
        children: [
          { label: 'Invoice Queue', path: '/finance/invoices' },
          { label: '3-Way Matching', path: '/finance/matching' },
        ]
      },
      { label: 'Payments', path: '/finance/payments', icon: <CashIcon className={iconClass} />,
        children: [
          { label: 'Payment Queue', path: '/finance/payments' },
          { label: 'Official GRNs', path: '/finance/grns' },
          { label: 'Letters of Credit', path: '/finance/letters-of-credit' },
        ]
      },
      { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} /> },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} /> },
      { label: 'Reports', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
    ],
    [ROLES.BUDGET_CONTROLLER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Finance', path: '/finance', icon: <CashIcon className={iconClass} />,
        children: [
          { label: 'Overview', path: '/finance' },
          { label: 'Budgets', path: '/finance/budgets' },
        ]
      },
      { label: 'Invoices', path: '/finance/invoices', icon: <DocumentTextIcon className={iconClass} />, badge: badges.invoices || undefined,
        children: [
          { label: 'Invoice Queue', path: '/finance/invoices' },
          { label: '3-Way Matching', path: '/finance/matching' },
        ]
      },
      { label: 'Payments', path: '/finance/payments', icon: <CashIcon className={iconClass} />,
        children: [
          { label: 'Payment Queue', path: '/finance/payments' },
          { label: 'Official GRNs', path: '/finance/grns' },
          { label: 'Letters of Credit', path: '/finance/letters-of-credit' },
        ]
      },
      { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} /> },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} /> },
      { label: 'Reports', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
    ],
    [ROLES.DEPARTMENT_HEAD]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} />, badge: badges.requisitions || undefined },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} /> },
    ],
    [ROLES.USER_DEPT_STAFF]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} />,
        children: [
          { label: 'Create New', path: '/requisitions/create' },
          { label: 'My Requisitions', path: '/requisitions' },
        ]
      },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} /> },
    ],
    [ROLES.PROCUREMENT_MANAGER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Solicitations', path: '/solicitations', icon: <DocumentTextIcon className={iconClass} /> },
      { label: 'Bid Management', path: '/bids', icon: <LockOpenIcon className={iconClass} />,
        children: [
          { label: 'Bid Opening List', path: '/bids/opening' },
          { label: 'Opening Setup', path: '/bids/opening/setup' },
          { label: 'All Bids', path: '/bids' },
          { label: 'Minutes Archive', path: '/bids/opening/minutes' },
          { label: 'Late/Rejected Bids', path: '/bids/late-rejected' },
        ]
      },
      { label: 'Evaluations', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} />,
        children: [
          { label: 'Committee Formation', path: '/evaluations/committee/formation' },
          { label: 'Active Evaluations', path: '/evaluations' },
          { label: 'Post-Qualification', path: '/evaluations/post-qualification' },
        ]
      },
      { label: 'Contracts', path: '/contracts', icon: <DocumentIcon className={iconClass} />,
        children: [
          { label: 'All Contracts', path: '/contracts' },
          { label: 'Award Overview', path: '/contracts/award-overview' },
          { label: 'Award Notices', path: '/contracts/award-notices' },
          { label: 'Standstill Monitor', path: '/contracts' },
          { label: 'Appeals', path: '/contracts/appeals' },
          { label: 'Generate Contract', path: '/contracts/generate' },
          { label: 'Performance Security', path: '/contracts/performance-security' },
        ]
      },
      { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} /> },
    ],
    [ROLES.AUDITOR]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
    ],
    [ROLES.ZPPA_REPORTING_OFFICER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
      { label: 'Reports', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
    ],
    [ROLES.INTEGRATION_MANAGER]: [
      { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
    ],
  };

  if (role && items[role]) {
    return items[role];
  }

  return [
    { label: 'Dashboard', path: '/dashboard', icon: <ChartBarIcon className={iconClass} /> },
    { label: 'Procurement Planning', path: '/procurement-planning', icon: <ClipboardListIcon className={iconClass} /> },
    { label: 'Requisitions', path: '/requisitions', icon: <PencilIcon className={iconClass} /> },
    { label: 'Solicitations', path: '/solicitations', icon: <DocumentTextIcon className={iconClass} /> },
    { label: 'Bid Management', path: '/bids', icon: <LockOpenIcon className={iconClass} /> },
    { label: 'Evaluations', path: '/evaluations', icon: <DocumentDuplicateIcon className={iconClass} /> },
    { label: 'Contracts', path: '/contracts', icon: <DocumentIcon className={iconClass} /> },
    { label: 'Finance', path: '/finance', icon: <CashIcon className={iconClass} /> },
    { label: 'Reports', path: '/reports', icon: <TrendingUpIcon className={iconClass} /> },
  ];
}

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const logout = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const normalizedRole = user?.role === 'zppa_reporter' ? 'zppa_reporting_officer' : user?.role;
  const navItems = useSidebarItems(normalizedRole);

  const sidebarFooter = (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="w-10 h-10 bg-zammsa-green rounded-xl flex items-center justify-center shadow-sm shrink-0">
        <span className="text-white text-sm font-bold">
          {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{user?.full_name}</p>
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider truncate">
          {user?.role?.replace(/_/g, ' ')}
        </p>
      </div>
      <button 
        onClick={logout}
        className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
        title="Logout"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );

  const getRoleTitle = (role?: string) => {
    if (!role) return 'Internal Portal';
    const titles: Record<string, string> = {
      [ROLES.PROCUREMENT_OFFICER]: 'Procurement Officer',
      [ROLES.PROCUREMENT_MANAGER]: 'Procurement Manager',
      [ROLES.DIRECTOR_PROCUREMENT]: 'Director of Procurement',
      [ROLES.EVALUATION_COMMITTEE_MEMBER]: 'Evaluation Committee Member',
      [ROLES.EVALUATION_COMMITTEE_CHAIR]: 'Evaluation Committee Chair',
      [ROLES.ZPC_MEMBER]: 'ZPC Member',
      [ROLES.DIRECTOR_GENERAL]: 'Director General',
      [ROLES.CONTRACT_MANAGER]: 'Contract Manager',
      [ROLES.FINANCE_OFFICER]: 'Finance Officer',
      [ROLES.BUDGET_CONTROLLER]: 'Budget Controller',
      [ROLES.DEPARTMENT_HEAD]: 'Department Head',
      [ROLES.USER_DEPT_STAFF]: 'Department Staff',
      [ROLES.AUDITOR]: 'Auditor',
      [ROLES.ZPPA_REPORTING_OFFICER]: 'ZPPA Reporting Officer',
      [ROLES.INTEGRATION_MANAGER]: 'Integration Manager',
    };
    return titles[role] || role.replace(/_/g, ' ');
  };

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 font-sans">
      <Sidebar 
        navItems={navItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        accentColor="zammsa-green"
        footer={sidebarFooter}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => setSidebarOpen(true)}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-slate-900 leading-tight">ZAMMSA PMS</h2>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{getRoleTitle(user?.role)}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <NotificationBell />
            
            <div className="h-6 w-px bg-slate-200" />
            
            <div className="flex items-center gap-3">
               <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 leading-none">{user?.full_name}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">{getRoleTitle(user?.role)}</p>
               </div>
               <div className="w-8 h-8 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                  <span className="text-zammsa-green font-bold text-xs">
                    {user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
               </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto max-w-7xl w-full mx-auto">
          <React.Suspense fallback={<PageLoader />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
