import apiClient from './client';
import type {
  ProcurementDashboardData,
  FinanceDashboardData,
  DepartmentDashboardData,
  DGDashboardData,
  ZPCDashboardData,
  EvaluationDashboardData,
  ContractManagerDashboardData,
  AuditorDashboardData,
} from '../types';

export const fetchProcurementDashboard = (): Promise<ProcurementDashboardData> =>
  apiClient.get(`/reporting/dashboards/procurement/`).then((r) => {
    const raw = r.data as any;
    return {
      key_metrics: [
        { label: 'Total Procurements', value: raw.by_status?.reduce((s: any, i: any) => s + (i.count || 0), 0) || 0, change: 0 },
        { label: 'Avg Processing Days', value: raw.average_processing_days || 0, change: 0 },
        { label: 'Active Solicitations', value: raw.by_status?.filter((i: any) => i.status === 'active' || i.status === 'published').reduce((s: any, i: any) => s + (i.count || 0), 0) || 0, change: 0 },
        { label: 'Completed', value: raw.by_status?.filter((i: any) => i.status === 'completed' || i.status === 'awarded').reduce((s: any, i: any) => s + (i.count || 0), 0) || 0, change: 0 },
      ],
      solicitations_by_status: (raw.by_status || []).map((s: any) => ({ status: s.status, count: s.count })),
      upcoming_deadlines: [],
      recent_activities: [],
      tasks: [],
    } as ProcurementDashboardData;
  });

export const fetchFinanceDashboard = (): Promise<FinanceDashboardData> =>
  apiClient.get(`/reporting/dashboards/financial/`).then((r) => {
    const raw = r.data as any;
    const depts = (raw.budget_utilization_by_dept || []).map((d: any) => ({ department: d.department, allocated: d.value || 0, spent: 0 }));
    const totalBudget = raw.total_procurement_value || 0;
    return {
      budget_utilization: [],
      pending_invoices: [],
      payment_queue: [],
      department_breakdown: depts,
      alerts: [],
      total_budget: totalBudget,
      total_spent: 0,
      total_remaining: totalBudget,
    } as FinanceDashboardData;
  });

export const fetchDepartmentDashboard = (): Promise<DepartmentDashboardData> =>
  apiClient.get(`/procurement-planning/annual-plans/dashboard/`).then((r) => {
    const raw = r.data as any;
    return {
      pending_requisitions: [],
      budget_utilization: { allocated: raw.total_value || 0, spent: 0, remaining: raw.total_value || 0 },
      staff_summary: [],
    } as DepartmentDashboardData;
  });

export const fetchDGDashboard = (): Promise<DGDashboardData> =>
  apiClient.get(`/reporting/dashboards/executive/`).then((r) => {
    const raw = r.data as any;
    return {
      executive_kpis: [
        { label: 'Total Value', value: raw.total_value || 0, change: 0 },
        { label: 'Total Procurements', value: raw.total_procurements || 0, change: 0 },
        { label: 'Avg Processing Days', value: raw.avg_processing_days || 0, change: 0 },
        { label: 'Methods Used', value: (raw.by_method || []).length, change: 0 },
      ],
      procurement_by_method: (raw.by_method || []).map((m: any) => ({ method: m.method, value: m.value || 0 })),
      procurement_by_department: (raw.by_department || []).map((d: any) => ({ department: d.department, value: d.value || 0 })),
      monthly_trend: [],
      top_suppliers: [],
      pending_approvals_count: 0,
      total_procurement_value: raw.total_value || 0,
      active_contracts: 0,
    } as DGDashboardData;
  });

export const fetchZPCDashboard = (): Promise<ZPCDashboardData> =>
  apiClient.get(`/reporting/dashboards/executive/`).then(() => ({
    pending_ber_approvals: [],
    pending_amendments: [],
    pending_justifications: [],
    approval_history: [],
    upcoming_meetings: [],
  } as ZPCDashboardData));

export const fetchEvaluationDashboard = (): Promise<EvaluationDashboardData> =>
  apiClient.get(`/evaluations/committees/`).then((r) => {
    const raw = r.data as any;
    const committees = raw.results || raw.data || raw || [];
    const assignments = (Array.isArray(committees) ? committees : []).map((c: any) => ({
      id: c.id || '',
      solicitation: c.solicitation_title || c.solicitation || '',
      role: c.user_role || c.role || 'member',
      deadline: c.deadline || c.closing_date || new Date().toISOString(),
      status: c.status || 'pending',
    }));
    return {
      assignments,
      scoring_matrix: [],
      chair_data: { committee_id: '', members: [], financial_envelopes_opened: false, ber_generated: false, ber_signed: false },
    } as EvaluationDashboardData;
  });

export const fetchContractManagerDashboard = (): Promise<ContractManagerDashboardData> =>
  apiClient.get(`/contracts/`).then((r) => {
    const raw = r.data as any;
    const contracts = raw.results || raw.data || raw || [];
    const active = (Array.isArray(contracts) ? contracts : []).filter((c: any) => c.status === 'active' || c.status === 'approved').map((c: any) => ({
      id: c.id || '',
      title: c.title || '',
      vendor: c.vendor_name || c.vendor || '',
      value: c.value || 0,
      end_date: c.end_date || '',
      status: c.status || 'active',
    }));
    return {
      active_contracts: active,
      upcoming_milestones: [],
      alerts: [],
    } as ContractManagerDashboardData;
  });

export const fetchAuditorDashboard = (): Promise<AuditorDashboardData> =>
  apiClient.get(`/audit-logs/`).then((r) => {
    const raw = r.data as any;
    const logs = raw.results || raw.data || raw || [];
    const recent = (Array.isArray(logs) ? logs : []).slice(0, 20).map((l: any) => ({
      id: l.id || '',
      user: l.user || '',
      action: l.action || '',
      resource: l.resource || '',
      timestamp: l.timestamp || l.created_at || '',
      ip: l.ip || '',
    }));
    return {
      recent_logs: recent,
      summary: { total_logs: raw.count || raw.total || recent.length, today_logs: 0, unique_users: 0, anomalies: 0 },
    } as AuditorDashboardData;
  });

export const approveRequisition = (id: string, comment: string) =>
  apiClient.post(`/requisitions/${id}/approve/`, { comment }).then((r) => r.data);

export const rejectRequisition = (id: string, reason: string) =>
  apiClient.post(`/requisitions/${id}/approve/`, { comment: `REJECTED: ${reason}` }).then((r) => r.data);

export const approveBER = (id: string, comment: string) =>
  apiClient.post(`/evaluations/reports/${id}/approve/`, { comment }).then((r) => r.data);

export const rejectBER = (id: string, reason: string) =>
  apiClient.post(`/evaluations/reports/${id}/reject/`, { reason }).then((r) => r.data);

export const saveEvaluationScore = (solicitationId: string, data: any) =>
  apiClient.post(`/evaluations/technical-scores/submit/`, { solicitation: solicitationId, ...data }).then((r) => r.data);

export const submitEvaluation = (solicitationId: string) =>
  apiClient.post(`/evaluations/technical-scores/submit/`, { solicitation: solicitationId }).then((r) => r.data);

export const openFinancialEnvelopes = (solicitationId: string) =>
  apiClient.post(`/evaluations/financial/`, { solicitation: solicitationId }).then((r) => r.data);

export const generateBER = (solicitationId: string) =>
  apiClient.post(`/evaluations/reports/`, { solicitation: solicitationId }).then((r) => r.data);

export const signBER = (solicitationId: string, password: string) =>
  apiClient.post(`/evaluations/reports/${solicitationId}/submit/`, { password }).then((r) => r.data);

export const fetchAuditLogs = (params: {
  search?: string; action?: string; user?: string; resource?: string;
  start_date?: string; end_date?: string; page?: number; limit?: number;
}): Promise<{ data: any[]; total: number }> =>
    apiClient.get(`/audit-logs/`, { params }).then((r) => ({
      data: r.data.results ?? r.data.data ?? r.data,
      total: r.data.count ?? r.data.total ?? 0,
    }));
