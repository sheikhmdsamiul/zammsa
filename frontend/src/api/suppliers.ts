import api from './client';
import { Supplier, PaginatedResponse } from '../types';

export const suppliersApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Supplier>>('/suppliers/', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Supplier>(`/suppliers/${id}/`).then((r) => r.data),

  register: (data: FormData) =>
    api.post<Supplier>('/suppliers/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  update: (id: string, data: Partial<Supplier>) =>
    api.patch<Supplier>(`/suppliers/${id}/`, data).then((r) => r.data),

  approve: (id: string, data?: { comment: string }) =>
    api.patch(`/suppliers/${id}/`, { status: 'approved', ...data }).then((r) => r.data),

  reject: (id: string, data: { reason: string }) =>
    api.patch(`/suppliers/${id}/`, { status: 'rejected', ...data }).then((r) => r.data),

  listApplications: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Supplier>>('/suppliers/applications/', { params }).then((r) => r.data),

  reviewApplication: (id: string, data: { status: string; comment: string }) =>
    api.post(`/suppliers/applications/${id}/review/`, data).then((r) => r.data),

  listPerformances: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/suppliers/performances/', { params }).then((r) => r.data),

  getPerformance: (id: string) =>
    api.get<any>(`/suppliers/performances/?supplier=${id}`).then((r) => r.data),

  evaluatePerformance: (supplierPk: string, data: { metrics: Record<string, any>; overall_score: number; improvement_notes?: string }) =>
    api.post<any>(`/suppliers/performances/evaluate/${supplierPk}/`, data).then((r) => r.data),

  getRiskScore: (id: string) =>
    api.get<{ score: number; factors: any[] }>(`/suppliers/risk-scores/`).then((r) => r.data),

  validateZRA: (taxId: string) =>
    api.post('/suppliers/', { tax_id: taxId, validation_type: 'zra' }).then((r) => r.data),

  validatePACRA: (registrationNumber: string) =>
    api.post('/suppliers/', { registration_number: registrationNumber, validation_type: 'pacra' }).then((r) => r.data),

  validateNATS: (napsaNumber: string) =>
    api.post('/suppliers/', { nats_number: napsaNumber, validation_type: 'nats' }).then((r) => r.data),

  export: (params?: Record<string, any>) =>
    api.get('/suppliers/', { params, responseType: 'blob' }),
};
