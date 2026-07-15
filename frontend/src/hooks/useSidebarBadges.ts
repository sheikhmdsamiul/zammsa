import { useQuery } from '@tanstack/react-query';
import { requisitionsApi } from '../api/requisitions';
import { procurementPlanningApi } from '../api/procurement_planning';
import { vendorApi } from '../api/vendor';
import { notificationsApi } from '../api/notifications';
import { solicitationsApi } from '../api/solicitations';
import { evaluationsApi } from '../api/evaluations';

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
  milestones: number;
  invoices: number;
  unreadNotifications: number;
  myBids: number;
  myContracts: number;
  vendorInvoices: number;
}

function useSidebarBadges(userRole: string | undefined): SidebarBadges {
  const { data: reqDashboard } = useQuery({
    queryKey: ['sidebar', 'requisitions', 'dashboard'],
    queryFn: () => requisitionsApi.dashboard(),
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

  const pendingDeptHead = reqDashboard?.pending_dept_head ?? 0;
  const pendingFinance = reqDashboard?.pending_finance ?? 0;
  const pendingDG = reqDashboard?.pending_dg ?? 0;
  const pendingZPC = reqDashboard?.pending_zpc ?? 0;
  const submitted = reqDashboard?.submitted ?? 0;

  const cppPendingZPC = cppDashboard?.pending_zpc ?? 0;

  const unread = notifSummary?.unread_count ?? 0;

  const solPending = solPendingApproval ?? 0;
  const activeEvaluationCount = activeEvals ?? 0;

  return {
    requisitions: pendingDeptHead + pendingFinance + pendingDG + pendingZPC + submitted,
    approvals: pendingDeptHead + pendingFinance + pendingDG + pendingZPC,
    solicitations: solPending,
    bids: 0,
    evaluations: activeEvaluationCount,
    berPending: 0,
    appReviews: solPending,
    cppReviews: cppPendingZPC,
    contracts: 0,
    milestones: 0,
    invoices: 0,
    unreadNotifications: unread,
    myBids: vendorDashboard?.active_bids ?? 0,
    myContracts: vendorDashboard?.awarded_contracts ?? 0,
    vendorInvoices: vendorDashboard?.pending_invoices ?? 0,
  };
}

export default useSidebarBadges;
