import api from './client';
import { Bid, PaginatedResponse } from '../types';

export const bidsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Bid>>('/bids/', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Bid>(`/bids/${id}/`).then((r) => r.data),

  create: (data: Partial<Bid>) =>
    api.post<Bid>('/bids/', data).then((r) => r.data),

  update: (id: string, data: Partial<Bid>) =>
    api.patch<Bid>(`/bids/${id}/`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/bids/${id}/`),

  submit: (id: string) =>
    api.patch(`/bids/${id}/`, { status: 'submitted' }).then((r) => r.data),

  withdraw: (id: string) =>
    api.patch(`/bids/${id}/`, { status: 'withdrawn' }).then((r) => r.data),

  modify: (id: string, data: Partial<Bid>) =>
    api.patch<Bid>(`/bids/${id}/`, data).then((r) => r.data),

  verifySecurity: (id: string, data: { verified: boolean; notes?: string }) =>
    api.post(`/bids/securities/`, { bid: id, ...data }).then((r) => r.data),

  openBids: (solicitationId: string) =>
    api.post(`/bids/openings/`, { solicitation: solicitationId }).then((r) => r.data),

  listOpenings: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/bids/openings/', { params }).then((r) => r.data),

  getOpeningMinutes: (openingId: string) =>
    api.get(`/bids/openings/${openingId}/`, { responseType: 'blob' }),

  startOpeningSession: (solicitationId: string, data: {
    witnesses?: string[];
    scheduled_opening_time?: string;
    public_live_link?: string;
    observations?: string;
    location?: string;
  }) =>
    api.post<any>(`/bids/openings/start/${solicitationId}/`, data).then((r) => r.data),

  openSingleBid: (openingId: string, bidId: string, data?: { financial_sealed?: boolean; objections?: string }) =>
    api.post<any>(`/bids/openings/${openingId}/open-bid/${bidId}/`, data || {}).then((r) => r.data),

  getOpening: (openingId: string) =>
    api.get<any>(`/bids/openings/${openingId}/`).then((r) => r.data),

  getMinutes: (openingId: string) =>
    api.get<any>(`/bids/openings/${openingId}/minutes/`).then((r) => r.data),

  sendMinutes: (openingId: string) =>
    api.post<any>(`/bids/openings/${openingId}/send-minutes/`).then((r) => r.data),

  finalizeOpening: (openingId: string, data: {
    observations?: string;
    witness_signatures?: Array<{ name: string; role: string; signed_at: string }>;
  }) =>
    api.post<any>(`/bids/openings/${openingId}/finalize/`, data).then((r) => r.data),

  getPublicOpening: (solicitationId: string) =>
    api.get<any>(`/bids/public/openings/${solicitationId}/`).then((r) => r.data),

  listLateRejected: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/bids/', { params: { ...params, status: 'non_responsive' } }).then((r) => r.data),

  listLateBids: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/bids/', { params: { ...params, is_late: true } }).then((r) => r.data),
};
