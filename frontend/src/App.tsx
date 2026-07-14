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
import { INTERNAL_PORTAL_ROLES, ROLES, SUPPLIER_PORTAL_ROLES, EVALUATION_COMMITTEE_ROLES } from './config/rbac';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const Login = React.lazy(() => import('./components/auth/Login'));
const ForgotPassword = React.lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./components/auth/ResetPassword'));
const ChangePassword = React.lazy(() => import('./components/auth/ChangePassword'));
const NotificationsInbox = React.lazy(() => import('./components/common/NotificationsInbox'));

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
const VendorTenderDetail = React.lazy(() => import('./components/vendor/VendorTenderDetail'));
const BidSubmission = React.lazy(() => import('./components/vendor/BidSubmission'));
const MyBids = React.lazy(() => import('./components/vendor/MyBids'));
const MyContracts = React.lazy(() => import('./components/vendor/MyContracts'));
const VendorContractDetail = React.lazy(() => import('./components/vendor/VendorContractDetail'));
const VendorContractSigning = React.lazy(() => import('./components/vendor/VendorContractSigning'));
const SubmitInvoice = React.lazy(() => import('./components/vendor/SubmitInvoice'));
const SupplierDeliveryLog = React.lazy(() => import('./components/vendor/SupplierDeliveryLog'));
const SupplierExecutionTrack = React.lazy(() => import('./components/vendor/SupplierExecutionTrack'));
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
const SolicitationEdit = React.lazy(() => import('./components/solicitations/SolicitationEdit'));

const BidsList = React.lazy(() => import('./components/bids/BidsList'));
const BidDetail = React.lazy(() => import('./components/bids/BidDetail'));
const BidOpeningCeremony = React.lazy(() => import('./components/bids/BidOpeningCeremony'));
const BidOpeningList = React.lazy(() => import('./components/bids/BidOpeningList'));
const OpeningSetup = React.lazy(() => import('./components/bids/OpeningSetup'));
const MinutesArchive = React.lazy(() => import('./components/bids/MinutesArchive'));
const LateRejectedBids = React.lazy(() => import('./components/bids/LateRejectedBids'));

const EvaluationsList = React.lazy(() => import('./components/evaluations/EvaluationsList'));
const EvaluationDetail = React.lazy(() => import('./components/evaluations/EvaluationDetail'));
const CommitteeFormation = React.lazy(() => import('./components/evaluations/CommitteeFormation'));
const ConflictOfInterestDeclaration = React.lazy(() => import('./components/evaluations/ConflictOfInterestDeclaration'));
const PreliminaryExamination = React.lazy(() => import('./components/evaluations/PreliminaryExamination'));
const TechnicalScoring = React.lazy(() => import('./components/evaluations/TechnicalScoring'));
const FinancialEvaluation = React.lazy(() => import('./components/evaluations/FinancialEvaluation'));
const ScoreConsolidation = React.lazy(() => import('./components/evaluations/ScoreConsolidation'));
const BERWorkflow = React.lazy(() => import('./components/evaluations/BERWorkflow'));
const PostQualification = React.lazy(() => import('./components/evaluations/PostQualification'));
const ZPCApproval = React.lazy(() => import('./components/evaluations/ZPCApproval'));

const ContractsList = React.lazy(() => import('./components/contracts/ContractsList'));
// DEPRECATED: Direct creation route now redirects to ContractGeneration
const ContractCreate = React.lazy(() => import('./components/contracts/ContractCreate'));
const ContractDetail = React.lazy(() => import('./components/contracts/ContractDetail'));
const ContractGeneration = React.lazy(() => import('./components/contracts/ContractGeneration'));
const StandstillMonitor = React.lazy(() => import('./components/contracts/StandstillMonitor'));
const ContractSigning = React.lazy(() => import('./components/contracts/ContractSigning'));
const PerformanceSecurity = React.lazy(() => import('./components/contracts/PerformanceSecurity'));
const AwardOverview = React.lazy(() => import('./components/awards/AwardOverview'));
const AwardNotices = React.lazy(() => import('./components/awards/AwardNotices'));
const Appeals = React.lazy(() => import('./components/awards/Appeals'));
const ContractClosureChecklist = React.lazy(() => import('./components/contracts/ContractClosureChecklist'));
const ContractArchiving = React.lazy(() => import('./components/contracts/ContractArchiving'));
const SupplierPerformanceEval = React.lazy(() => import('./components/contracts/SupplierPerformanceEval'));
const ContractAmendments = React.lazy(() => import('./components/contracts/ContractAmendments'));
const LiquidatedDamages = React.lazy(() => import('./components/contracts/LiquidatedDamages'));
const MilestonesList = React.lazy(() => import('./components/contracts/MilestonesList'));
const AmendmentsList = React.lazy(() => import('./components/contracts/AmendmentsList'));
const LiquidatedDamagesList = React.lazy(() => import('./components/contracts/LiquidatedDamagesList'));
const SupplierPerformanceList = React.lazy(() => import('./components/contracts/SupplierPerformanceList'));
const ContractClosureList = React.lazy(() => import('./components/contracts/ContractClosureList'));
const ExecutionDashboard = React.lazy(() => import('./components/contracts/ExecutionDashboard'));
const DeliveryManager = React.lazy(() => import('./components/contracts/DeliveryManager'));
const RetentionReleasePanel = React.lazy(() => import('./components/contracts/RetentionReleasePanel'));

const FinanceDashboard = React.lazy(() => import('./components/finance/FinanceDashboard'));
const FinanceBudgets = React.lazy(() => import('./components/finance/Budgets'));
const FinanceInvoices = React.lazy(() => import('./components/finance/Invoices'));
const ThreeWayMatch = React.lazy(() => import('./components/finance/ThreeWayMatch'));
const DiscrepancyReview = React.lazy(() => import('./components/finance/DiscrepancyReview'));
const FinancePayments = React.lazy(() => import('./components/finance/Payments'));
const FinanceLettersOfCredit = React.lazy(() => import('./components/finance/LettersOfCredit'));
const RetentionTracker = React.lazy(() => import('./components/finance/RetentionTracker'));
const InvoiceApproval = React.lazy(() => import('./components/finance/InvoiceApproval'));
const GRNDeliveryLog = React.lazy(() => import('./components/execution/GRNDeliveryLog'));

const SuppliersList = React.lazy(() => import('./components/suppliers/SuppliersList'));
const SupplierDetail = React.lazy(() => import('./components/suppliers/SupplierDetail'));

const Reports = React.lazy(() => import('./components/reports/Reports'));

const BudgetAllocationList = React.lazy(() => import('./components/procurement-planning/BudgetAllocationList'));
const APPList = React.lazy(() => import('./components/procurement-planning/APPList'));
const APPCreate = React.lazy(() => import('./components/procurement-planning/APPCreate'));
const APPDetail = React.lazy(() => import('./components/procurement-planning/APPDetail'));
const APPEdit = React.lazy(() => import('./components/procurement-planning/APPEdit'));
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
const TemplateManagement = React.lazy(() => import('./components/admin/TemplateManagement'));

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
                  <Route path="notifications" element={<NotificationsInbox />} />
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
                  <Route path="solicitations/:id/edit" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.SYSTEM_ADMIN]}>
                      <SolicitationEdit />
                    </ProtectedRoute>
                  } />
                  <Route path="bids" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES, ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <BidsList />
                    </ProtectedRoute>
                  } />
                  <Route path="bids/:id" element={<BidDetail />} />
                  <Route path="bids/opening" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <BidOpeningList />
                    </ProtectedRoute>
                  } />
                  <Route path="bids/opening/:solId" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <BidOpeningCeremony />
                    </ProtectedRoute>
                  } />
                  <Route path="bids/opening/setup" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <OpeningSetup />
                    </ProtectedRoute>
                  } />
                  <Route path="bids/opening/minutes" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <MinutesArchive />
                    </ProtectedRoute>
                  } />
                  <Route path="bids/late-rejected" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <LateRejectedBids />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <EvaluationsList />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/committee/formation" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <CommitteeFormation />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/preliminary/:solId" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES]}>
                      <PreliminaryExamination />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/post-qualification" element={
                    <ProtectedRoute roles={[ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT, ROLES.PROCUREMENT_OFFICER]}>
                      <PostQualification />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/zpc-approval" element={
                    <ProtectedRoute roles={[ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <ZPCApproval />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/:id" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES]}>
                      <EvaluationDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/:committeeId/scoring" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES]}>
                      <TechnicalScoring />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/:committeeId/coi" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES]}>
                      <ConflictOfInterestDeclaration />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/:solId/financial" element={
                    <ProtectedRoute roles={[ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT]}>
                      <FinancialEvaluation />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/:solId/consolidation" element={
                    <ProtectedRoute roles={[ROLES.EVALUATION_COMMITTEE_CHAIR, ROLES.DIRECTOR_PROCUREMENT]}>
                      <ScoreConsolidation />
                    </ProtectedRoute>
                  } />
                  <Route path="evaluations/ber/:solId" element={
                    <ProtectedRoute roles={[...EVALUATION_COMMITTEE_ROLES, ROLES.ZPC_MEMBER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <BERWorkflow />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.DIRECTOR_GENERAL, ROLES.ZPC_MEMBER]}>
                      <ContractsList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/create" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.SYSTEM_ADMIN]}>
                      <ContractGeneration />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/generate" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.ZPC_MEMBER]}>
                      <ContractGeneration />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/award-overview" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <AwardOverview />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/award-notices" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <AwardNotices />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/appeals" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.ZPC_MEMBER]}>
                      <Appeals />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/performance-security" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.CONTRACT_MANAGER]}>
                      <PerformanceSecurity />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/milestones" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER]}>
                      <MilestonesList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/amendments" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <AmendmentsList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/liquidated-damages" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER]}>
                      <LiquidatedDamagesList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/supplier-performance" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <SupplierPerformanceList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/closure" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <ContractClosureList />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.PROCUREMENT_OFFICER, ROLES.FINANCE_OFFICER, ROLES.DIRECTOR_GENERAL, ROLES.ZPC_MEMBER]}>
                      <ContractDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/standstill" element={
                    <ProtectedRoute roles={[ROLES.PROCUREMENT_OFFICER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <StandstillMonitor />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/signing" element={
                    <ProtectedRoute roles={[
                      ROLES.PROCUREMENT_OFFICER,
                      ROLES.PROCUREMENT_MANAGER,
                      ROLES.DIRECTOR_PROCUREMENT,
                      ROLES.CONTRACT_MANAGER,
                      ROLES.DIRECTOR_GENERAL,
                      ROLES.SYSTEM_ADMIN,
                    ]}>
                      <ContractSigning />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/amendments" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <ContractAmendments />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/ld" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <LiquidatedDamages />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/performance" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <SupplierPerformanceEval />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/closure" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.DIRECTOR_PROCUREMENT]}>
                      <ContractClosureChecklist />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/execution" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.PROCUREMENT_OFFICER, ROLES.FINANCE_OFFICER]}>
                      <ExecutionDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/delivery" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.PROCUREMENT_OFFICER]}>
                      <DeliveryManager />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/archive" element={
                    <ProtectedRoute roles={[ROLES.CONTRACT_MANAGER, ROLES.PROCUREMENT_MANAGER, ROLES.DIRECTOR_PROCUREMENT, ROLES.SYSTEM_ADMIN]}>
                      <ContractArchiving />
                    </ProtectedRoute>
                  } />
                  <Route path="contracts/:id/retention-release" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <RetentionReleasePanel />
                    </ProtectedRoute>
                  } />
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
                  <Route path="finance/matching" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.CONTRACT_MANAGER]}>
                      <ThreeWayMatch />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/discrepancies" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER]}>
                      <DiscrepancyReview />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/payments" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinancePayments />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/grns" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.CONTRACT_MANAGER, ROLES.DIRECTOR_GENERAL]}>
                      <GRNDeliveryLog />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/letters-of-credit" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <FinanceLettersOfCredit />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/retention" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DIRECTOR_GENERAL, ROLES.CONTRACT_MANAGER]}>
                      <RetentionTracker />
                    </ProtectedRoute>
                  } />
                  <Route path="finance/invoices/:invoiceId/approval" element={
                    <ProtectedRoute roles={[ROLES.FINANCE_OFFICER, ROLES.BUDGET_CONTROLLER, ROLES.DEPARTMENT_HEAD, ROLES.DIRECTOR_GENERAL]}>
                      <InvoiceApproval />
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
                  <Route path="procurement-planning/:id/edit" element={
                    <ProtectedRoute roles={[ROLES.USER_DEPT_STAFF, ROLES.SYSTEM_ADMIN]}>
                      <APPEdit />
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
                  <Route path="notifications" element={<NotificationsInbox />} />
                  <Route path="open-tenders" element={<OpenTenders />} />
                  <Route path="open-tenders/:id/bid" element={<BidSubmission />} />
                  <Route path="open-tenders/:id" element={<VendorTenderDetail />} />
                  <Route path="bids" element={<MyBids />} />
                  <Route path="bids/:id" element={<BidDetail />} />
                  <Route path="contracts" element={<MyContracts />} />
                  <Route path="contracts/:id" element={<VendorContractDetail />} />
                  <Route path="contracts/:id/execution" element={<SupplierExecutionTrack />} />
                  <Route path="contracts/:id/sign" element={<VendorContractSigning />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/new" element={<SubmitInvoice />} />
                  <Route path="invoices/new/:contractId" element={<SubmitInvoice />} />
                  <Route path="deliveries/new" element={<SupplierDeliveryLog />} />
                  <Route path="deliveries/new/:contractId" element={<SupplierDeliveryLog />} />
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
                  <Route path="templates" element={<TemplateManagement />} />
                  <Route path="notifications" element={<NotificationsInbox />} />
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
                  <Route path="notifications" element={<NotificationsInbox />} />
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
