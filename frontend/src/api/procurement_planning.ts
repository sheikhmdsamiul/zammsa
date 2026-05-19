import api from './client';
import { AnnualProcurementPlan, APPLineItem, GeneralProcurementNotice, BudgetAllocation, PaginatedResponse, APPDashboardStats, BudgetSummary, ContractProcurementPlan, ProcurementMilestone, CPPRisk } from '../types';

export const procurementPlanningApi = {
  dashboard: () =>
    api.get<APPDashboardStats>('/procurement-planning/annual-plans/dashboard/').then(r => r.data),

  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<AnnualProcurementPlan>>('/procurement-planning/annual-plans/', { params }).then(r => r.data),

  detail: (id: string) =>
    api.get<AnnualProcurementPlan>(`/procurement-planning/annual-plans/${id}/`).then(r => r.data),

  create: (data: Partial<AnnualProcurementPlan>) =>
    api.post<AnnualProcurementPlan>(`/procurement-planning/annual-plans/`, data).then(r => r.data),

  update: (id: string, data: Partial<AnnualProcurementPlan>) =>
    api.patch<AnnualProcurementPlan>(`/procurement-planning/annual-plans/${id}/`, data).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/procurement-planning/annual-plans/${id}/`),

  submit: (id: string) =>
    api.post<{ message: string; status: string; approval_trail: any[] }>(`/procurement-planning/annual-plans/${id}/submit/`).then(r => r.data),

  approve: (id: string, data?: Record<string, any>) =>
    api.post<{ message: string; status: string; approval_trail: any[] }>(`/procurement-planning/annual-plans/${id}/approve/`, data || {}).then(r => r.data),

  reject: (id: string, reason: string) =>
    api.post<{ message: string; status: string }>(`/procurement-planning/annual-plans/${id}/reject/`, { reason }).then(r => r.data),

  returnForRevision: (id: string, reason: string) =>
    api.post<{ message: string; status: string }>(`/procurement-planning/annual-plans/${id}/return/`, { reason }).then(r => r.data),

  complianceCheck: (id: string, data: { compliance_status: string; notes?: string }) =>
    api.post<{ message: string; status: string }>(`/procurement-planning/annual-plans/${id}/compliance/`, data).then(r => r.data),

  consolidate: (id: string, consolidateIntoId: string, notes?: string) =>
    api.post<{ message: string; consolidated_app: string; consolidated_into: string }>(`/procurement-planning/annual-plans/${id}/consolidate/`, { consolidate_into: consolidateIntoId, notes }).then(r => r.data),

  approvalTrail: (id: string) =>
    api.get<{ app_id: string; status: string; approval_trail: any[] }>(`/procurement-planning/annual-plans/${id}/approval-trail/`).then(r => r.data),

  generateGPN: (id: string) =>
    api.post<{ message: string; gpn: GeneralProcurementNotice }>(`/procurement-planning/annual-plans/${id}/generate-gpn/`).then(r => r.data),

  publishAPP: (id: string, data?: { targets?: string[]; proofs?: Record<string, any> }) =>
    api.post<{ message: string; status: string; publication_targets: string[]; published_at: string }>(`/procurement-planning/annual-plans/${id}/publish/`, data || {}).then(r => r.data),

  submitToZPPA: (id: string, submissionRef: string) =>
    api.post<{ message: string; zppa_submitted_at: string; submission_ref: string }>(`/procurement-planning/annual-plans/${id}/zppa-submit/`, { submission_ref: submissionRef }).then(r => r.data),

  getZPPADeadlineAlerts: () =>
    api.get<{ approaching: any[]; overdue: any[]; total_alerts: number }>('/procurement-planning/annual-plans/zppa-deadline-alerts/').then(r => r.data),

  lineItems: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<APPLineItem>>('/procurement-planning/line-items/', { params }).then(r => r.data),
    create: (data: Partial<APPLineItem>) =>
      api.post<APPLineItem>('/procurement-planning/line-items/', data).then(r => r.data),
    update: (id: string, data: Partial<APPLineItem>) =>
      api.patch<APPLineItem>(`/procurement-planning/line-items/${id}/`, data).then(r => r.data),
    delete: (id: string) =>
      api.delete(`/procurement-planning/line-items/${id}/`),
  },

  gpn: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<GeneralProcurementNotice>>('/procurement-planning/notices/', { params }).then(r => r.data),
    detail: (id: string) =>
      api.get<GeneralProcurementNotice>(`/procurement-planning/notices/${id}/`).then(r => r.data),
    publish: (id: string, targets: string[], proofUrls?: string[]) =>
      api.post<{ message: string; status: string; publication_targets: string[]; published_at: string }>(`/procurement-planning/notices/${id}/publish/`, { targets, proof_urls: proofUrls || [] }).then(r => r.data),
    archive: (id: string) =>
      api.post<{ message: string; status: string }>(`/procurement-planning/notices/${id}/archive/`).then(r => r.data),
  },

  contractPlans: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<ContractProcurementPlan>>('/procurement-planning/contract-plans/', { params }).then(r => r.data),
    create: (data: Partial<ContractProcurementPlan>) =>
      api.post<ContractProcurementPlan>(`/procurement-planning/contract-plans/`, data).then(r => r.data),
    detail: (id: string) =>
      api.get<ContractProcurementPlan>(`/procurement-planning/contract-plans/${id}/`).then(r => r.data),
    update: (id: string, data: Partial<ContractProcurementPlan>) =>
      api.patch<ContractProcurementPlan>(`/procurement-planning/contract-plans/${id}/`, data).then(r => r.data),
    delete: (id: string) =>
      api.delete(`/procurement-planning/contract-plans/${id}/`),
    submit: (id: string) =>
      api.post<{ message: string; status: string }>(`/procurement-planning/contract-plans/${id}/submit/`).then(r => r.data),
    approve: (id: string, data?: Record<string, any>) =>
      api.post<{ message: string; status: string }>(`/procurement-planning/contract-plans/${id}/approve/`, data || {}).then(r => r.data),
    reject: (id: string, reason: string, returnForRevision?: boolean) =>
      api.post<{ message: string; status: string }>(`/procurement-planning/contract-plans/${id}/reject/`, { 
        reason, 
        return_for_revision: returnForRevision 
      }).then(r => r.data),
    return: (id: string, reason: string) =>
      api.post<{ message: string; status: string }>(`/procurement-planning/contract-plans/${id}/return/`, { reason }).then(r => r.data),
    lockBaseline: (id: string) =>
      api.post<{ message: string; is_baseline_locked: boolean; baseline_locked_at: string }>(`/procurement-planning/contract-plans/${id}/lock-baseline/`).then(r => r.data),
    updateMilestone: (cppId: string, milestoneId: string, data: Partial<ProcurementMilestone>) =>
      api.post<{ message: string; milestone: ProcurementMilestone }>(`/procurement-planning/contract-plans/${cppId}/update-milestone/${milestoneId}/`, data).then(r => r.data),
    createAmendment: (id: string, data: Partial<ContractProcurementPlan>) =>
      api.post<{ message: string; amendment_version: number; status: string }>(`/procurement-planning/contract-plans/${id}/create-amendment/`, data).then(r => r.data),
    methodOverrideApprove: (id: string, data: { override_reason?: string; new_method?: string }) =>
      api.post<{ message: string; status: string }>(`/procurement-planning/contract-plans/${id}/method-override-approve/`, data).then(r => r.data),
    dashboard: () =>
      api.get<{ total: number; draft: number; pending_zpc: number; approved: number; rejected: number; active: number; completed: number; cancelled: number; baseline_locked: number; total_value: number }>('/procurement-planning/contract-plans/dashboard/').then(r => r.data),
    varianceAlerts: () =>
      api.get<{ alerts: any[]; total_alerts: number }>('/procurement-planning/contract-plans/variance-alerts/').then(r => r.data),
    archive: (id: string) =>
      api.post<{ message: string; status: string; archived_at: string; retention_expiry: string }>(`/procurement-planning/contract-plans/${id}/archive/`).then(r => r.data),
  },

  milestones: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<ProcurementMilestone>>('/procurement-planning/milestones/', { params }).then(r => r.data),
    create: (data: Partial<ProcurementMilestone>) =>
      api.post<ProcurementMilestone>(`/procurement-planning/milestones/`, data).then(r => r.data),
    update: (id: string, data: Partial<ProcurementMilestone>) =>
      api.patch<ProcurementMilestone>(`/procurement-planning/milestones/${id}/`, data).then(r => r.data),
    delete: (id: string) =>
      api.delete(`/procurement-planning/milestones/${id}/`),
  },

  cppRisks: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<CPPRisk>>(`/procurement-planning/cpp-risks/`, { params }).then(r => r.data),
    create: (data: Partial<CPPRisk>) =>
      api.post<CPPRisk>(`/procurement-planning/cpp-risks/`, data).then(r => r.data),
    update: (id: string, data: Partial<CPPRisk>) =>
      api.patch<CPPRisk>(`/procurement-planning/cpp-risks/${id}/`, data).then(r => r.data),
    delete: (id: string) =>
      api.delete(`/procurement-planning/cpp-risks/${id}/`),
  },
};

export const budgetApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<BudgetAllocation>>('/finance/budget-allocations/', { params }).then(r => r.data),
  detail: (id: string) =>
    api.get<BudgetAllocation>(`/finance/budget-allocations/${id}/`).then(r => r.data),
  create: (data: Partial<BudgetAllocation>) =>
    api.post<BudgetAllocation>('/finance/budget-allocations/', data).then(r => r.data),
  syncFromERP: (allocations: any[]) =>
    api.post<{ message: string; synced_count: number; errors: any[] }>('/finance/budget-allocations/sync-from-erp/', { allocations }).then(r => r.data),
  summary: (params?: Record<string, string>) =>
    api.get<BudgetSummary>('/finance/budget-allocations/summary/', { params }).then(r => r.data),
};

export const methodApi = {
  recommend: (data: { estimated_value: number; commodity_type?: string; department_id?: string }) =>
    api.post<{ recommended_method: string; rationale: string; estimated_value: number }>('/method-selection/recommendations/recommend/', data).then(r => r.data),
};

export interface MasterDepartment {
  dept_id: string;
  dept_code: string;
  dept_name: string;
  level: string;
  region: string;
  is_active: boolean;
}

export interface MasterFiscalYear {
  fiscal_year_id: string;
  year_code: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_closed: boolean;
}

export const masterDataApi = {
  departments: (params?: Record<string, any>) =>
    api.get<{ results: MasterDepartment[] }>('/master-data/departments/', { params }).then(r => r.data),
  fiscalYears: (params?: Record<string, any>) =>
    api.get<{ results: MasterFiscalYear[] }>('/master-data/fiscal-years/', { params }).then(r => r.data),
};
