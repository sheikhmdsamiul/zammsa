import React from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { LoadingPage } from './components/common/LoadingSpinner';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import PublicLayout from './components/public/PublicLayout';
import { INTERNAL_PORTAL_ROLES, ROLES, SUPPLIER_PORTAL_ROLES } from './config/rbac';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const Login = React.lazy(() => import('./components/auth/Login'));
const ForgotPassword = React.lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./components/auth/ResetPassword'));
const ChangePassword = React.lazy(() => import('./components/auth/ChangePassword'));

const Home = React.lazy(() => import('./components/public/Home'));
const TendersList = React.lazy(() => import('./components/public/TendersList'));
const TenderDetail = React.lazy(() => import('./components/public/TenderDetail'));
const NewsList = React.lazy(() => import('./components/public/NewsList'));
const NewsDetail = React.lazy(() => import('./components/public/NewsDetail'));
const NoticesList = React.lazy(() => import('./components/public/NoticesList'));
const NoticeDetail = React.lazy(() => import('./components/public/NoticeDetail'));
const EventsList = React.lazy(() => import('./components/public/EventsList'));
const FAQ = React.lazy(() => import('./components/public/FAQ'));
const Contact = React.lazy(() => import('./components/public/Contact'));
const About = React.lazy(() => import('./components/public/About'));

const VendorLayout = React.lazy(() => import('./components/layout/VendorLayout'));
const VendorDashboard = React.lazy(() => import('./components/vendor/VendorDashboard'));
const OpenTenders = React.lazy(() => import('./components/vendor/OpenTenders'));
const BidSubmission = React.lazy(() => import('./components/vendor/BidSubmission'));
const MyBids = React.lazy(() => import('./components/vendor/MyBids'));
const MyContracts = React.lazy(() => import('./components/vendor/MyContracts'));
const VendorContractDetail = React.lazy(() => import('./components/vendor/VendorContractDetail'));
const Invoices = React.lazy(() => import('./components/vendor/Invoices'));
const VendorProfile = React.lazy(() => import('./components/vendor/VendorProfile'));
const VendorSettings = React.lazy(() => import('./components/vendor/VendorSettings'));
const VendorRegistrationWizard = React.lazy(() => import('./components/vendor/VendorRegistrationWizard'));

const DashboardLayout = React.lazy(() => import('./components/layout/DashboardLayout'));
const AdminLayout = React.lazy(() => import('./components/layout/AdminLayout'));

const DashboardRouter = React.lazy(() => import('./components/dashboard/DashboardRouter'));

const RequisitionsList = React.lazy(() => import('./components/requisitions/RequisitionsList'));
const RequisitionCreate = React.lazy(() => import('./components/requisitions/RequisitionCreate'));
const RequisitionDetail = React.lazy(() => import('./components/requisitions/RequisitionDetail'));
const RequisitionEdit = React.lazy(() => import('./components/requisitions/RequisitionEdit'));

const SolicitationsList = React.lazy(() => import('./components/solicitations/SolicitationsList'));
const SolicitationCreate = React.lazy(() => import('./components/solicitations/SolicitationCreate'));
const SolicitationDetail = React.lazy(() => import('./components/solicitations/SolicitationDetail'));

const BidsList = React.lazy(() => import('./components/bids/BidsList'));
const BidDetail = React.lazy(() => import('./components/bids/BidDetail'));

const EvaluationsList = React.lazy(() => import('./components/evaluations/EvaluationsList'));
const EvaluationDetail = React.lazy(() => import('./components/evaluations/EvaluationDetail'));

const ContractsList = React.lazy(() => import('./components/contracts/ContractsList'));
const ContractCreate = React.lazy(() => import('./components/contracts/ContractCreate'));
const ContractDetail = React.lazy(() => import('./components/contracts/ContractDetail'));

const FinanceDashboard = React.lazy(() => import('./components/finance/FinanceDashboard'));
const FinanceBudgets = React.lazy(() => import('./components/finance/Budgets'));
const FinanceInvoices = React.lazy(() => import('./components/finance/Invoices'));
const FinancePayments = React.lazy(() => import('./components/finance/Payments'));
const FinanceLettersOfCredit = React.lazy(() => import('./components/finance/LettersOfCredit'));

const SuppliersList = React.lazy(() => import('./components/suppliers/SuppliersList'));
const SupplierDetail = React.lazy(() => import('./components/suppliers/SupplierDetail'));

const Reports = React.lazy(() => import('./components/reports/Reports'));

const BudgetAllocationList = React.lazy(() => import('./components/procurement-planning/BudgetAllocationList'));
const APPList = React.lazy(() => import('./components/procurement-planning/APPList'));
const APPCreate = React.lazy(() => import('./components/procurement-planning/APPCreate'));
const APPDetail = React.lazy(() => import('./components/procurement-planning/APPDetail'));
const GPNList = React.lazy(() => import('./components/procurement-planning/GPNList'));
const GPNDetail = React.lazy(() => import('./components/procurement-planning/GPNDetail'));
const CPPList = React.lazy(() => import('./components/procurement-planning/CPPList'));
const CPPCreate = React.lazy(() => import('./components/procurement-planning/CPPCreate'));
const CPPDetail = React.lazy(() => import('./components/procurement-planning/CPPDetail'));
const CPPEdit = React.lazy(() => import('./components/procurement-planning/CPPEdit'));
const GPNListPublic = React.lazy(() => import('./components/public/GPNListPublic'));
const GPNDetailPublic = React.lazy(() => import('./components/public/GPNDetailPublic'));

const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));
const UserManagement = React.lazy(() => import('./components/admin/UserManagement'));
const RoleManagement = React.lazy(() => import('./components/admin/RoleManagement'));
const VendorApplications = React.lazy(() => import('./components/admin/VendorApplications'));
const VendorManagement = React.lazy(() => import('./components/admin/VendorManagement'));
const SystemHealth = React.lazy(() => import('./components/admin/SystemHealth'));
const AdminAuditLogs = React.lazy(() => import('./components/admin/AuditLogs'));
const GovernanceSettings = React.lazy(() => import('./components/admin/GovernanceSettings'));
const IntegrationMonitor = React.lazy(() => import('./components/admin/IntegrationMonitor'));
const SystemSettings = React.lazy(() => import('./components/admin/SystemSettings'));
const DepartmentManagement = React.lazy(() => import('./components/admin/DepartmentManagement'));
const FiscalYearManagement = React.lazy(() => import('./components/admin/FiscalYearManagement'));
const CommodityManagement = React.lazy(() => import('./components/admin/CommodityManagement'));
const BudgetAllocationManagement = React.lazy(() => import('./components/admin/BudgetAllocationManagement'));
const AdminReports = React.lazy(() => import('./components/admin/Reports'));
const BackupManagement = React.lazy(() => import('./components/admin/BackupManagement'));

const SupplierRelationsLayout = React.lazy(() => import('./components/layout/SupplierRelationsLayout'));
const SupplierRelationsDashboard = React.lazy(() => import('./components/supplier-relations/SupplierRelationsDashboard'));

const PublicHome: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    if (user?.role === ROLES.SUPPLIER_USER) {
      return <Navigate to="/vendor/dashboard" replace />;
    }
    if (user?.role === ROLES.SUPPLIER_RELATIONSHIP_MANAGER) {
      return <Navigate to="/supplier-relations" replace />;
    }
    if (user?.role === ROLES.SYSTEM_ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <Home />;
};

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <BrowserRouter>
            <React.Suspense fallback={<LoadingPage />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/change-password" element={<ChangePassword />} />

                <Route element={<PublicLayout />}>
                  <Route index element={<PublicHome />} />
                  <Route path="tenders" element={<TendersList />} />
                  <Route path="tenders/:id" element={<TenderDetail />} />
                  <Route path="news" element={<NewsList />} />
                  <Route path="news/:id" element={<NewsDetail />} />
                  <Route path="notices" element={<NoticesList />} />
                  <Route path="notices/:id" element={<NoticeDetail />} />
                  <Route path="events" element={<EventsList />} />
                  <Route path="faq" element={<FAQ />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="gpns" element={<GPNListPublic />} />
                  <Route path="gpns/:id" element={<GPNDetailPublic />} />
                  <Route path="about" element={<About />} />
                </Route>

                <Route
                  path="/"
                  element={
                    <ProtectedRoute roles={[...INTERNAL_PORTAL_ROLES]}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardRouter />} />
                  <Route path="requisitions" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.FINANCE_OFFICER, ROLES.DIRECTOR_GENERAL]}>
                      <RequisitionsList />
                    </ProtectedRoute>
                  } />
                  <Route path="requisitions/create" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF]}>
                      <RequisitionCreate />
                    </ProtectedRoute>
                  } />
                  <Route path="requisitions/:id" element={<RequisitionDetail />} />
                  <Route path="requisitions/:id/edit" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF]}>
                      <RequisitionEdit />
                    </ProtectedRoute>
                  } />
                  <Route path="solicitations" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <SolicitationsList />
                    </ProtectedRoute>
                  } />
                  <Route path="solicitations/create" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.SYSTEM_ADMIN]}>
                      <SolicitationCreate />
                    </ProtectedRoute>
                  } />
                  <Route path="solicitations/:id" element={<SolicitationDetail />} />
                  <Route path="bids" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.EVALUATION_COMMITTEE_MEMBER, ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <BidsList />
                    </ProtectedRoute>
                  } />
                  <Route path="bids/:id" element={<BidDetail />} />
                  <Route path="evaluations" element={
                    <ProtectedRoute roles={[ROLES.EVALUATION_COMMITTEE_MEMBER, ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <EvaluationsList />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/:id" element={<EvaluationDetail />} />
                  <Route path="contracts" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL, ROLES.ZPC_MEMBER]}>
                      <ContractsList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/create" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.SYSTEM_ADMIN]}>
                      <ContractCreate />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id" element={<ContractDetail />} />
                  <Route path="finance" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinanceDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/budgets" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinanceBudgets />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/invoices" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinanceInvoices />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/payments" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinancePayments />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/letters-of-credit" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinanceLettersOfCredit />
                    </ProtectedRoute>
                  } />
                  <Route path="suppliers" element={
                    <ProtectedRoute roles={[ROLES.SUPPLIER_RELATIONSHIP_MANAGER]}>
                      <SuppliersList />
                    </ProtectedRoute>
                  } />
                  <Route path="suppliers/:id" element={
                    <ProtectedRoute roles={[ROLES.SUPPLIER_RELATIONSHIP_MANAGER]}>
                      <SupplierDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="reports" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL, ROLES.ZPPA_REPORTING_OFFICER, ROLES.BUDGET_CONTROLLER]}>
                      <Reports />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL]}>
                      <APPList />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/create" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.SYSTEM_ADMIN]}>
                      <APPCreate />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/:id" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL]}>
                      <APPDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/budgets" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL]}>
                      <BudgetAllocationList />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/gpns" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL]}>
                      <GPNList />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/gpns/:id" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.DEPARTMENT_HEAD, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.FINANCE_OFFICER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL]}>
                      <GPNDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/cpp" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.ZPC_MEMBER, ROLES.SYSTEM_ADMIN]}>
                      <CPPList />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/cpp/create" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.SYSTEM_ADMIN]}>
                      <CPPCreate />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/cpp/:id" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.ZPC_MEMBER, ROLES.SYSTEM_ADMIN]}>
                      <CPPDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="procurement-planning/cpp/:id/edit" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.SYSTEM_ADMIN]}>
                      <CPPEdit />
                    </ProtectedRoute>
                  } />
                </Route>

                <Route
                  path="/vendor"
                  element={
                    <ProtectedRoute roles={[...SUPPLIER_PORTAL_ROLES]}>
                      <VendorLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<VendorDashboard />} />
                  <Route path="open-tenders" element={<OpenTenders />} />
                  <Route path="open-tenders/:id/bid" element={<BidSubmission />} />
                  <Route path="bids" element={<MyBids />} />
                  <Route path="bids/:id" element={<BidDetail />} />
                  <Route path="contracts" element={<MyContracts />} />
                  <Route path="contracts/:id" element={<VendorContractDetail />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="profile" element={<VendorProfile />} />
                  <Route path="settings" element={<VendorSettings />} />
                </Route>
                <Route path="/suppliers/register" element={<VendorRegistrationWizard />} />

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={['system_admin']}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="users/create" element={<UserManagement />} />
                  <Route path="users/:id/edit" element={<UserManagement />} />
                  <Route path="roles" element={<RoleManagement />} />
                  <Route path="vendor-applications" element={<VendorApplications />} />
                  <Route path="vendors" element={<VendorManagement />} />
                  <Route path="system-health" element={<SystemHealth />} />
                  <Route path="audit-logs" element={<AdminAuditLogs />} />
                  <Route path="governance" element={<GovernanceSettings />} />
                  <Route path="integrations" element={<IntegrationMonitor />} />
                  <Route path="settings" element={<SystemSettings />} />
                  <Route path="departments" element={<DepartmentManagement />} />
                  <Route path="fiscal-years" element={<FiscalYearManagement />} />
                  <Route path="commodities" element={<CommodityManagement />} />
                  <Route path="budget-allocations" element={<BudgetAllocationManagement />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="backups" element={<BackupManagement />} />
                </Route>

                <Route
                  path="/supplier-relations"
                  element={
                    <ProtectedRoute roles={['supplier_relationship_manager']}>
                      <SupplierRelationsLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<SupplierRelationsDashboard />} />
                  <Route path="vendor-applications" element={<VendorApplications />} />
                  <Route path="vendors" element={<VendorManagement />} />
                  <Route path="reports" element={<AdminReports />} />
                </Route>

                <Route path="*" element={
                  <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">404 - Page Not Found</p></div>
                } />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </ErrorBoundary>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
