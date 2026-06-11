import api from './client';
import { Solicitation, EvaluationCriterion, PaginatedResponse } from '../types';

export const solicitationsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Solicitation>>('/solicitations/', { params }).then((r) => r.data),

  listCriteria: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<EvaluationCriterion>>('/solicitations/criteria/', { params }).then((r) => r.data),

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

  /** Fetch template preview HTML content */
  templatePreview: (name: string, method?: string) =>
    api.get('/solicitations/templates/preview/', {
      params: { name, method },
      responseType: 'text' as any,
    }).then((r) => r.data as string),

  documents: {
    upload: (solicitationId: string, file: File, documentType?: string, isPublic?: boolean) => {
      const fd = new FormData();
      fd.append('file', file);
      if (documentType) fd.append('document_type', documentType);
      if (isPublic !== undefined) fd.append('is_public', String(isPublic));
      return api.post<{ message: string; document: any }>(`/solicitations/${solicitationId}/documents/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    delete: (solicitationId: string, documentId: string) =>
      api.delete(`/solicitations/${solicitationId}/documents/${documentId}/`).then(r => r.data),
    copyCppDocuments: (solicitationId: string, cppDocumentIds: string[]) =>
      api.post(`/solicitations/${solicitationId}/copy-cpp-documents/`, { cpp_document_ids: cppDocumentIds }).then(r => r.data),
  },
};
