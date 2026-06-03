import api from './client';
import { EvaluationCommittee, PaginatedResponse, ConflictOfInterest, CommitteeCOIState, MyScoresResponse, ScoreAverageResult, ScoreThresholdResult, PassedTechBid, CombinedScoreResult } from '../types';

export const evaluationsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/technical-scores/', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<any>(`/evaluations/technical-scores/${id}/`).then((r) => r.data),

  listCommittees: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<EvaluationCommittee>>('/evaluations/committees/', { params }).then((r) => r.data),

  getCommittee: (committeeId: string) =>
    api.get<EvaluationCommittee>(`/evaluations/committees/${committeeId}/`).then((r) => r.data),

  formCommittee: (data: Partial<EvaluationCommittee>) =>
    api.post<EvaluationCommittee>('/evaluations/committees/', data).then((r) => r.data),

  updateCommittee: (committeeId: string, data: Partial<EvaluationCommittee>) =>
    api.patch<EvaluationCommittee>(`/evaluations/committees/${committeeId}/`, data).then((r) => r.data),

  deleteCommittee: (committeeId: string) =>
    api.delete(`/evaluations/committees/${committeeId}/`),

  addMember: (committeeId: string, data: { user: string; role: string }) =>
    api.patch(`/evaluations/committees/${committeeId}/`, { add_member: data }).then((r) => r.data),

  declareCOI: (committeeId: string, data: {
    declaration?: string; has_conflict?: boolean; declaration_type?: string;
    conflicted_bidders?: string[]; explanation?: string; confidentiality_agreed?: boolean;
  }) => api.post<ConflictOfInterest>(`/evaluations/committees/${committeeId}/declare-coi/`, data).then((r) => r.data),

  getCOI: (committeeId: string) =>
    api.get<CommitteeCOIState>(`/evaluations/committees/${committeeId}/coi/`).then((r) => r.data),

  submitScores: (data: { bid_id: string; criterion_id: string; raw_score: number; comment?: string }) =>
    api.post(`/evaluations/technical-scores/submit/`, data).then((r) => r.data),

  getMyScores: (bidId: string) =>
    api.get<MyScoresResponse>(`/evaluations/technical-scores/my/${bidId}/`).then((r) => r.data),

  calculateAverages: (bidId: string) =>
    api.post<{ message: string; bid_id: string; results: ScoreAverageResult[] }>(`/evaluations/technical-scores/averages/${bidId}/`).then((r) => r.data),

  thresholdCheck: (bidId: string, threshold?: number) =>
    api.post<ScoreThresholdResult>(`/evaluations/technical-scores/threshold-check/${bidId}/`, { threshold: threshold || 70 }).then((r) => r.data),

  authorizeFinancialOpening: (solicitationId: string) =>
    api.post<{ message: string; opened_count: number }>(`/evaluations/financial/authorize-open/${solicitationId}/`).then((r) => r.data),

  listPassedTechBids: (solicitationId: string, threshold?: number) =>
    api.get<{ solicitation_id: string; threshold: number; bids: PassedTechBid[] }>(`/evaluations/financial/passed-bids/${solicitationId}/`, { params: { threshold: threshold || 70 } }).then((r) => r.data),

  calculateFinancial: (bidId: string, data: {
    original_price: number; corrected_price?: number; source_currency?: string;
    conversion_rate?: number; preference_margin?: number; preference_category?: string;
    arithmetic_corrections?: any[];
  }) => api.post(`/evaluations/financial/calculate/${bidId}/`, data).then((r) => r.data),

  calculateQCBS: (solicitationId: string) =>
    api.post<{ message: string; tech_weight: number; fin_weight: number; results: CombinedScoreResult[] }>(`/evaluations/qcbs/${solicitationId}/`).then((r) => r.data),

  selectWinner: (solicitationId: string, bidId: string) =>
    api.post<{ message: string; winner_id: string; winner_name: string; solicitation_status: string }>(`/evaluations/award/${solicitationId}/`, { bid_id: bidId }).then((r) => r.data),

  openFinancialEnvelopes: (solicitationId: string) =>
    api.post(`/evaluations/financial/`, { solicitation: solicitationId }).then((r) => r.data),

  generateBER: (solicitationId: string) =>
    api.post<any>(`/evaluations/reports/generate/${solicitationId}/`).then((r) => r.data),

  signBER: (reportId: string) =>
    api.post<any>(`/evaluations/reports/${reportId}/sign/`).then((r) => r.data),

  getBERSignatures: (reportId: string) =>
    api.get<any>(`/evaluations/reports/${reportId}/signatures/`).then((r) => r.data),

  submitBER: (reportId: string) =>
    api.post<any>(`/evaluations/reports/${reportId}/submit/`).then((r) => r.data),

  approveBER: (reportId: string, data?: { comment: string }) =>
    api.post<any>(`/evaluations/reports/${reportId}/approve/`, data).then((r) => r.data),

  rejectBER: (reportId: string, data: { reason: string }) =>
    api.post<any>(`/evaluations/reports/${reportId}/reject/`, data).then((r) => r.data),

  downloadBER: (reportId: string) =>
    api.get(`/evaluations/reports/${reportId}/`, { responseType: 'blob' }),

  listPostQuals: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/post-qualifications/', { params }).then((r) => r.data),

  listBERs: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/reports/', { params }).then((r) => r.data),
};
