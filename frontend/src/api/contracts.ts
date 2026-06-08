import api from './client';
import { Contract, PaginatedResponse, ContractMilestone } from '../types';

export const contractsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Contract>>('/contracts/', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Contract>(`/contracts/${id}/`).then((r) => r.data),

  create: (data: Partial<Contract>) =>
    api.post<Contract>('/contracts/', data).then((r) => r.data),

  update: (id: string, data: Partial<Contract>) =>
    api.patch<Contract>(`/contracts/${id}/`, data).then((r) => r.data),

  publishAward: (
    id: string,
    data?: {
      waiting_period_days?: number;
      waiting_period_start?: string;
      waiting_period_end?: string;
    },
  ) => api.post<any>(`/contracts/${id}/publish-award/`, data || {}).then((r) => r.data),

  setStandstill: (
    id: string,
    data: {
      waiting_period_days?: number;
      waiting_period_start?: string;
      waiting_period_end?: string;
      expire_now?: boolean;
      recalculate_end?: boolean;
      publish_award?: boolean;
    },
  ) => api.post<any>(`/contracts/${id}/set-standstill/`, data).then((r) => r.data),

  signSupplier: (id: string) =>
    api.post<any>(`/contracts/${id}/sign-supplier/`).then((r) => r.data),

  countersign: (id: string) =>
    api.post<any>(`/contracts/${id}/countersign/`).then((r) => r.data),

  uploadSecurity: (id: string, data: { security_type: string; amount: number; issuing_bank: string; reference_number?: string; expiry_date?: string }) =>
    api.post<any>(`/contracts/${id}/upload-security/`, data).then((r) => r.data),

  validateSecurity: (id: string, securityId: string, valid: boolean) =>
    api.post<any>(`/contracts/${id}/validate-security/${securityId}/`, { valid }).then((r) => r.data),

  assignManager: (id: string, data: { contract_manager_id: string; milestones?: { name: string; due_date: string }[] }) =>
    api.post<any>(`/contracts/${id}/assign-manager/`, data).then((r) => r.data),

  fileAppeal: (id: string, data: { grounds: string; supporting_docs?: any[] }) =>
    api.post<any>(`/contracts/${id}/file-appeal/`, data).then((r) => r.data),

  resolveAppeal: (id: string, appealId: string, data: { resolution: string; notes?: string }) =>
    api.post<any>(`/contracts/${id}/resolve-appeal/${appealId}/`, data).then((r) => r.data),

  activateAfterWaiting: (id: string) =>
    api.post<any>(`/contracts/${id}/activate/`).then((r) => r.data),

  closureChecklist: (id: string, data: Record<string, boolean | string>) =>
    api.post<any>(`/contracts/${id}/closure-checklist/`, data).then((r) => r.data),

  calculateLD: (id: string, data: { days_delayed: number; daily_rate: number }) =>
    api.post<any>(`/contracts/${id}/calculate-ld/`, data).then((r) => r.data),

  archive: (id: string, data?: { force?: boolean }) =>
    api.post<any>(`/contracts/${id}/archive/`, data || {}).then((r) => r.data),

  finalAcceptance: (id: string, data?: { acceptance_certificate_ref?: string }) =>
    api.post<any>(`/contracts/${id}/final-acceptance/`, data || {}).then((r) => r.data),

  amend: (id: string, data: { reason: string; description: string; financial_impact: number; legal_opinion_ref?: string }) =>
    api.post<any>(`/contracts/${id}/amend/`, data).then((r) => r.data),

  approveAmendment: (id: string, amendmentId: string) =>
    api.post<any>(`/contracts/${id}/amendments/${amendmentId}/approve/`).then((r) => r.data),

  signAmendment: (id: string, amendmentId: string, signedBy: string) =>
    api.post<any>(`/contracts/${id}/amendments/${amendmentId}/sign/`, { signed_by: signedBy }).then((r) => r.data),

  listMilestones: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/contracts/milestones/', { params }).then((r) => r.data),

  listAmendments: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/contracts/amendments/', { params }).then((r) => r.data),

  listClosures: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/contracts/closures/', { params }).then((r) => r.data),

  listLiquidatedDamages: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/contracts/liquidated-damages/', { params }).then((r) => r.data),

  listAppeals: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/contracts/appeals/', { params }).then((r) => r.data),

  listRetention: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Contract>>('/contracts/retention/', { params }).then((r) => r.data),

  export: (params?: Record<string, any>) =>
    api.get('/contracts/', { params, responseType: 'blob' }),

  updateMilestoneActual: (milestoneId: string, data: { actual_date: string; notes?: string }) =>
    api.post<ContractMilestone>(`/contracts/milestones/${milestoneId}/update-actual/`, data).then((r) => r.data),
};
