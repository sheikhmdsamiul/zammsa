import { useQuery } from '@tanstack/react-query';
import { requisitionsApi } from '../api/requisitions';
import { procurementPlanningApi } from '../api/procurement_planning';
import { vendorApi } from '../api/vendor';
import { notificationsApi } from '../api/notifications';
import { solicitationsApi } from '../api/solicitations';
import { evaluationsApi } from '../api/evaluations';
import { contractsApi } from '../api/contracts';
import { financeApi } from '../api/finance';

export interface SidebarBadges {
  requisitions: number;
  approvals: number;
  solicitations: number;
  bids: number;
  evaluations: number;
  berPending: number;
  appReviews: number;
  cppReviews: number;
  contracts: number;
  contractSignature: number;
  milestones: number;
  overdueMilestones: number;
  contractAmendments: number;
  invoices: number;
  unreadNotifications: number;
  myBids: number;
  myContracts: number;
  vendorInvoices: number;
}

function useSidebarBadges(userRole: string | undefined): SidebarBadges {
  const { data: reqDashboard } = useQuery({
    queryKey: ['sidebar', 'requisitions', 'dashboard', userRole],
    queryFn: () => requisitionsApi.dashboard(userRole),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: cppDashboard } = useQuery({
    queryKey: ['sidebar', 'cpp', 'dashboard'],
    queryFn: () => procurementPlanningApi.contractPlans.dashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: vendorDashboard } = useQuery({
    queryKey: ['sidebar', 'vendor', 'dashboard'],
    queryFn: () => vendorApi.getDashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: notifSummary } = useQuery({
    queryKey: ['sidebar', 'notifications', 'summary'],
    queryFn: () => notificationsApi.summary(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: solPendingApproval } = useQuery({
    queryKey: ['sidebar', 'solicitations', 'pending'],
    queryFn: () => solicitationsApi.list({ status: 'pending_approval', page_size: 1 }).then((r) => r.count ?? 0),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: activeEvals } = useQuery({
    queryKey: ['sidebar', 'evaluations', 'active'],
    queryFn: () => evaluationsApi.listCommittees({ page_size: 1 }).then((r) => r.count ?? 0),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: contractDash } = useQuery({
    queryKey: ['sidebar', 'contracts', 'dashboard'],
    queryFn: () => contractsApi.dashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: invoiceDash } = useQuery({
    queryKey: ['sidebar', 'invoices', 'dashboard', userRole],
    queryFn: () => financeApi.dashboard(userRole),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const myPending = reqDashboard?.my_pending ?? 0;

  const cppPendingZPC = cppDashboard?.pending_zpc ?? 0;

  const unread = notifSummary?.unread_count ?? 0;

  const solPending = solPendingApproval ?? 0;
  const activeEvaluationCount = activeEvals ?? 0;

  const contractPendingSignature = contractDash?.pending_signature ?? 0;
  const contractPendingMilestones = contractDash?.pending_milestones ?? 0;
  const contractOverdueMilestones = contractDash?.overdue_milestones ?? 0;
  const contractPendingAmendments = contractDash?.pending_amendments ?? 0;
  const contractActiveCount = contractDash?.active_count ?? 0;

  const invoiceMyPending = invoiceDash?.my_pending ?? 0;

  return {
    requisitions: myPending,
    approvals: myPending,
    solicitations: solPending,
    bids: 0,
    evaluations: activeEvaluationCount,
    berPending: 0,
    appReviews: solPending,
    cppReviews: cppPendingZPC,
    contracts: contractActiveCount,
    contractSignature: contractPendingSignature,
    milestones: contractPendingMilestones + contractOverdueMilestones,
    overdueMilestones: contractOverdueMilestones,
    contractAmendments: contractPendingAmendments,
    invoices: invoiceMyPending,
    unreadNotifications: unread,
    myBids: vendorDashboard?.active_bids ?? 0,
    myContracts: vendorDashboard?.awarded_contracts ?? 0,
    vendorInvoices: vendorDashboard?.pending_invoices ?? 0,
  };
}

export default useSidebarBadges;
