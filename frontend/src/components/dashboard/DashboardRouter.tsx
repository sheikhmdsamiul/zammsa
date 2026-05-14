import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useRedux';
import { ROLES } from '../../config/rbac';

const ProcurementDashboard = React.lazy(() => import('./ProcurementDashboard'));
const FinanceDashboard = React.lazy(() => import('./FinanceDashboard'));
const DepartmentHeadDashboard = React.lazy(() => import('./DepartmentHeadDashboard'));
const DirectorGeneralDashboard = React.lazy(() => import('./DirectorGeneralDashboard'));
const ZPCDashboard = React.lazy(() => import('./ZPCDashboard'));
const EvaluationDashboard = React.lazy(() => import('./EvaluationDashboard'));
const ContractManagerDashboard = React.lazy(() => import('./ContractManagerDashboard'));
const AuditorDashboard = React.lazy(() => import('./AuditorDashboard'));

const roleDashboard: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  [ROLES.PROCUREMENT_OFFICER]: ProcurementDashboard,
  [ROLES.PROCUREMENT_MANAGER]: ProcurementDashboard,
  [ROLES.DIRECTOR_PROCUREMENT]: ProcurementDashboard,
  [ROLES.FINANCE_OFFICER]: FinanceDashboard,
  [ROLES.BUDGET_CONTROLLER]: FinanceDashboard,
  [ROLES.DEPARTMENT_HEAD]: DepartmentHeadDashboard,
  [ROLES.USER_DEPT_STAFF]: DepartmentHeadDashboard,
  [ROLES.DIRECTOR_GENERAL]: DirectorGeneralDashboard,
  [ROLES.ZPC_MEMBER]: ZPCDashboard,
  [ROLES.EVALUATION_COMMITTEE_MEMBER]: EvaluationDashboard,
  [ROLES.EVALUATION_COMMITTEE_CHAIR]: EvaluationDashboard,
  [ROLES.CONTRACT_MANAGER]: ContractManagerDashboard,
  [ROLES.SUPPLIER_RELATIONSHIP_MANAGER]: ContractManagerDashboard,
  [ROLES.AUDITOR]: AuditorDashboard,
  [ROLES.ZPPA_REPORTING_OFFICER]: ProcurementDashboard,
  [ROLES.INTEGRATION_MANAGER]: ProcurementDashboard,
};

const DashboardRouter: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading user information...</p>
      </div>
    );
  }

  const role = user.role;
  const DashboardComponent = roleDashboard[role];

  if (!DashboardComponent) {
    if (role === ROLES.SYSTEM_ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">No dashboard configured for role: {role}</p>
      </div>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zammsa-green" />
        </div>
      }
    >
      <DashboardComponent />
    </React.Suspense>
  );
};

export default DashboardRouter;
