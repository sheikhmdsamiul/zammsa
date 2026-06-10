import api from './client';
import { Requisition, PaginatedResponse } from '../types';

export const requisitionsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Requisition>>('/requisitions/', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Requisition>(`/requisitions/${id}/`).then((r) => r.data),

  create: (data: Partial<Requisition>) =>
    api.post<Requisition>('/requisitions/', data).then((r) => r.data),

  update: (id: string, data: Partial<Requisition>) =>
    api.patch<Requisition>(`/requisitions/${id}/`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/requisitions/${id}/`),

  submit: (id: string, data?: { specifications?: any[] }) =>
    api.post(`/requisitions/${id}/submit/`, data || {}).then((r) => r.data),

  approve: (id: string, data?: { comment?: string; decision?: string }) =>
    api.post(`/requisitions/${id}/approve/`, data).then((r) => r.data),

  reject: (id: string, data: { reason: string }) =>
    api.post(`/requisitions/${id}/approve/`, { decision: 'rejected', comments: data.reason }).then((r) => r.data),

  returnForRevision: (id: string, reason: string) =>
    api.post(`/requisitions/${id}/approve/`, { decision: 'returned', comments: reason }).then((r) => r.data),

  budgetValidate: (id: string) =>
    api.post(`/requisitions/${id}/budget-validate/`).then((r) => r.data),

  amend: (id: string, data: Partial<Requisition>) =>
    api.post<Requisition>(`/requisitions/${id}/amend/`, data).then((r) => r.data),

  export: (params?: Record<string, any>) =>
    api.get('/requisitions/', { params, responseType: 'blob' }),

  uploadItemAttachment: (itemId: string, file: File) => {
    const form = new FormData();
    form.append('attachment', file);
    return api.post(`/requisitions/items/${itemId}/upload/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  import: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/requisitions/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};
