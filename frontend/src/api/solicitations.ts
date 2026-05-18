import api from './client';
import { Solicitation, PaginatedResponse } from '../types';

export const solicitationsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Solicitation>>('/solicitations/', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Solicitation>(`/solicitations/${id}/`).then((r) => r.data),

  create: (data: Partial<Solicitation>) =>
    api.post<Solicitation>('/solicitations/', data).then((r) => r.data),

  update: (id: string, data: Partial<Solicitation>) =>
    api.patch<Solicitation>(`/solicitations/${id}/`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/solicitations/${id}/`),

  submit: (id: string) =>
    api.post(`/solicitations/${id}/submit/`).then((r) => r.data),

  approve: (id: string) =>
    api.post(`/solicitations/${id}/approve/`).then((r) => r.data),

  reject: (id: string, reason: string) =>
    api.post(`/solicitations/${id}/reject/`, { reason }).then((r) => r.data),

  publish: (id: string, data?: { targets?: string[]; proofs?: Record<string, any> }) =>
    api.post(`/solicitations/${id}/publish/`, data || {}).then((r) => r.data),

  close: (id: string) =>
    api.post(`/solicitations/${id}/close/`).then((r) => r.data),

  addAddendum: (id: string, data: Record<string, any>) =>
    api.post<{ message: string; addendum: any }>(`/solicitations/${id}/addendum/`, data).then((r) => r.data),

  submitClarification: (id: string, data: { question: string }) =>
    api.post(`/solicitations/clarifications/`, { solicitation: id, ...data }).then((r) => r.data),

  answerClarification: (id: string, clarificationId: string, data: { answer: string }) =>
    api.post(`/solicitations/clarifications/${clarificationId}/answer/`, data).then((r) => r.data),

  export: (params?: Record<string, any>) =>
    api.get('/solicitations/', { params, responseType: 'blob' }),
};
