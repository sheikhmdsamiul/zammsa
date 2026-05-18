import api from './client';
import {
  TenderPublic, NewsArticle, Notice, Event, FAQItem,
  PublicStats, PaginatedResponse
} from '../types';

const publicApi = {
  getStats: () =>
    api.get<PublicStats>('/public/stats/').then((r) => r.data),

  listTenders: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<TenderPublic>>('/public/tenders/', { params }).then((r) => r.data),

  getTender: (id: string) =>
    api.get<TenderPublic>(`/public/tenders/${id}/`).then((r) => r.data),

  trackTenderView: (id: string) =>
    api.post(`/public/tenders/${id}/track-view/`),

  listNews: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<NewsArticle>>('/public/news/', { params }).then((r) => r.data),

  getNews: (id: string) =>
    api.get<NewsArticle>(`/public/news/${id}/`).then((r) => r.data),

  trackNewsView: (id: string) =>
    api.post(`/public/news/${id}/track-view/`),

  listNotices: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Notice>>('/public/notices/', { params }).then((r) => r.data),

  getNotice: (id: string) =>
    api.get<Notice>(`/public/notices/${id}/`).then((r) => r.data),

  trackNoticeView: (id: string) =>
    api.post(`/public/notices/${id}/track-view/`),

  listEvents: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Event>>('/public/events/', { params }).then((r) => r.data),

  listFAQs: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<FAQItem>>('/public/faqs/', { params }).then((r) => r.data),

  submitContact: (data: { name: string; email: string; subject: string; message: string }) =>
    api.post('/public/contact/', data).then((r) => r.data),

  downloadDocument: (tenderId: string, documentId: string) =>
    api.get(`/public/tenders/${tenderId}/documents/${documentId}/download/`, {
      responseType: 'blob',
    }),

  getBidOpening: (solicitationId: string) =>
    api.get<any>(`/bids/public/openings/${solicitationId}/`).then((r) => r.data),

  listGPNs: (params?: Record<string, any>) =>
    api.get<any>('/procurement-planning/public/gpns/', { params }).then((r) => r.data),

  getGPN: (id: string) =>
    api.get<any>(`/procurement-planning/public/gpns/${id}/`).then((r) => r.data),
};

export default publicApi;
