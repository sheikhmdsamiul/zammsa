import api from './client';
import {
  VendorRegistration, VendorDashboardStats, VendorActivity, UpcomingDeadline, VendorNotification, RegistrationDocument,
  TenderPublic, Bid, Contract, Invoice, ContractFinancialSummary, ExecutionDashboard, PaginatedResponse,
} from '../types';

export const vendorApi = {
  getDashboard: () =>
    api.get<VendorDashboardStats>('/suppliers/dashboard/').then((r) => r.data),
  getActivities: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<VendorActivity>>('/audit-logs/', { params }).then((r) => r.data as any),
  getUpcomingDeadlines: () =>
    api.get<UpcomingDeadline[]>('/solicitations/', { params: { status: 'published' } }).then((r) => r.data as any),
  getNotifications: () =>
    api.get<VendorNotification[]>('/audit-logs/', { params: { limit: 10 } }).then((r) => r.data as any),

  registration: {
    saveDraft: (data: Partial<VendorRegistration>) =>
      api.post<VendorRegistration>('/suppliers/applications/', data).then((r) => r.data),
    submit: (data: Partial<VendorRegistration>) =>
      api.post<VendorRegistration>('/suppliers/applications/', { ...data, status: 'submitted' }).then((r) => r.data),
    get: () =>
      api.get<VendorRegistration>('/suppliers/applications/').then((r) => r.data),
    update: (data: Partial<VendorRegistration>) =>
      api.patch<VendorRegistration>('/suppliers/applications/', data).then((r) => r.data),
    uploadDocument: (applicationId: string, type: string, file: File) => {
      const form = new FormData();
      form.append('document_type', type);
      form.append('file', file);
      return api.post<RegistrationDocument>(`/suppliers/applications/${applicationId}/upload-document/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    validatePACRA: (registrationNumber: string) =>
      api.post('/suppliers/validate-pacra/', { registration_number: registrationNumber, validation_type: 'pacra' }).then((r) => r.data),
    validateCEEC: (certificateNumber: string) =>
      api.post('/suppliers/validate-ceec/', { certificate_number: certificateNumber, validation_type: 'ceec' }).then((r) => r.data),
    getCommodityCategories: () =>
      api.get<string[]>('/master-data/commodities/').then((r) => r.data as any),
  },

  openTenders: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<TenderPublic>>('/public/tenders/', { params }).then((r) => r.data),
    get: (id: string) =>
      api.get<TenderPublic>(`/public/tenders/${id}/`).then((r) => r.data),
  },

  bids: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Bid>>('/bids/', { params }).then((r) => r.data),
    get: (id: string) =>
      api.get<Bid>(`/bids/${id}/`).then((r) => r.data),
    submitBid: (tenderId: string, data: FormData) => {
      data.append('solicitation_id', tenderId);
      return api.post<any>('/bids/submit/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    getAddenda: (solicitationId: string) =>
      api.get<{ solicitation: string; addenda: any[]; total_addenda: number }>(`/bids/addenda/${solicitationId}/`).then((r) => r.data),
    withdraw: (id: string) =>
      api.patch(`/bids/${id}/`, { status: 'withdrawn' }).then((r) => r.data),
    modify: (id: string, data: FormData) =>
      api.patch<Bid>(`/bids/${id}/`, data).then((r) => r.data),
    downloadDocument: (bidId: string, documentId: string) =>
      api.get(`/bids/${bidId}/`, { responseType: 'blob' }),
  },

  contracts: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Contract>>('/contracts/', { params }).then((r) => r.data),
    get: (id: string) =>
      api.get<Contract>(`/contracts/${id}/`).then((r) => r.data),
    sign: (id: string, data?: Record<string, any>) =>
      api.post<any>(`/contracts/${id}/sign-supplier/`, data || {}).then((r) => r.data),
    uploadSecurity: (id: string, data: { security_type?: string; amount: number; issuing_bank: string; reference_number?: string; expiry_date?: string }) =>
      api.post<any>(`/contracts/${id}/upload-security/`, data).then((r) => r.data),
    financialSummary: (id: string) =>
      api.get<ContractFinancialSummary>(`/finance/contracts/${id}/financial-summary/`).then((r) => r.data),
    executionDashboard: (id: string) =>
      api.get<ExecutionDashboard>(`/finance/contracts/${id}/execution-dashboard/`).then((r) => r.data),
  },

  invoices: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Invoice>>('/finance/invoices/', { params }).then((r) => r.data),
    get: (id: string) =>
      api.get<Invoice>(`/finance/invoices/${id}/`).then((r) => r.data),
    create: (data: FormData) =>
      api.post<Invoice>('/finance/invoices/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    submit: (id: string) =>
      api.post(`/finance/invoices/${id}/submit/`).then((r) => r.data),
    getGrns: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<any>>('/finance/grns/', { params }).then((r) => r.data),
    downloadPDF: (id: string) =>
      api.get(`/finance/invoices/${id}/`, { responseType: 'blob' }),
    submitDeliveryAdvice: (data: {
      contract_id: string;
      advice_number?: string;
      items: Array<{
        item_code?: string;
        item_name: string;
        quantity_ordered: number;
        quantity_delivered: number;
        unit_price: number;
        total_amount: number;
      }>;
      notes?: string;
    }) =>
      api.post<any>('/finance/supplier-delivery-log/', data).then((r) => r.data),
  },

  profile: {
    get: () =>
      api.get<VendorRegistration>('/suppliers/profile/').then((r) => r.data),
    update: (data: FormData) =>
      api.patch<VendorRegistration>('/suppliers/profile/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
  },

  settings: {
    changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
      api.post('/auth/change-password/', data),
    updateNotificationPreferences: (data: Record<string, boolean>) =>
      api.patch('/auth/me/', data),
    setupMFA: () =>
      api.post<{ secret: string; qr_code: string }>('/auth/mfa/setup/').then((r) => r.data),
    verifyMFA: (code: string) =>
      api.post<{ verified: boolean }>('/auth/mfa/verify/', { code }).then((r) => r.data),
  },
};
