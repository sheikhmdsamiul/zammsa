import api from './client';
import {
  EvaluationCommittee, PaginatedResponse, ConflictOfInterest, CommitteeCOIState,
  MyScoresResponse, ScoreAverageResult, ScoreThresholdResult,
  ConsolidatedScoresResponse, QCBSResponse,
  SelectWinnerResponse, AuthorizeOpeningResponse, PassedTechBidsResponse,
} from '../types';

export const evaluationsApi = {
  list: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/technical-scores/', { params }).then((r) => r.data),

  getConsolidatedScores: (solicitationId: string) =>
    api.get<ConsolidatedScoresResponse>(`/evaluations/consolidation/${solicitationId}/`).then((r) => r.data),

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
    api.post<AuthorizeOpeningResponse>(`/evaluations/financial/authorize-open/${solicitationId}/`).then((r) => r.data),

  listPassedTechBids: (solicitationId: string, threshold?: number) =>
    api.get<PassedTechBidsResponse>(`/evaluations/financial/passed-bids/${solicitationId}/`, { params: { threshold: threshold || 70 } }).then((r) => r.data),

  calculateFinancial: (bidId: string, data: {
    original_price: number; corrected_price?: number; source_currency?: string;
    conversion_rate?: number; preference_margin?: number; preference_category?: string;
    arithmetic_corrections?: any[];
  }) => api.post(`/evaluations/financial/calculate/${bidId}/`, data).then((r) => r.data),

  calculateQCBS: (solicitationId: string) =>
    api.post<QCBSResponse>(`/evaluations/qcbs/${solicitationId}/`).then((r) => r.data),

  selectWinner: (solicitationId: string, bidId: string) =>
    api.post<SelectWinnerResponse>(`/evaluations/award/${solicitationId}/`, { bid_id: bidId }).then((r) => r.data),

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
    api.get(`/evaluations/reports/${reportId}/pdf/?format=pdf`, { responseType: 'blob' }).then((r) => r.data),

  listPostQuals: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/post-qualifications/', { params }).then((r) => r.data),

  getPostQual: (pqId: string) =>
    api.get<any>(`/evaluations/post-qualifications/${pqId}/`).then((r) => r.data),

  updatePQItem: (pqId: string, data: { item_id: string; status?: string; notes?: string; contact_result?: string }) =>
    api.post<any>(`/evaluations/post-qualifications/${pqId}/update-item/`, data).then((r) => r.data),

  generatePQChecklist: (pqId: string) =>
    api.post<any>(`/evaluations/post-qualifications/${pqId}/generate-checklist/`).then((r) => r.data),

  getPQVerificationContext: (pqId: string) =>
    api.get<any>(`/evaluations/post-qualifications/${pqId}/verification-context/`).then((r) => r.data),

  listBERs: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/reports/', { params }).then((r) => r.data),

  getBER: (reportId: string) =>
    api.get<any>(`/evaluations/reports/${reportId}/`).then((r) => r.data),

  listPreliminaryExams: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/preliminary/', { params }).then((r) => r.data),

  savePreliminaryExam: (data: { bid: string; criterion: string; is_compliant: boolean; comment?: string }) =>
    api.post<any>('/evaluations/preliminary/', data).then((r) => r.data),

  updatePreliminaryExam: (examId: string, data: { is_compliant?: boolean; comment?: string }) =>
    api.patch<any>(`/evaluations/preliminary/${examId}/`, data).then((r) => r.data),

  getPhaseStatus: (solicitationId: string) =>
    api.get<any>(`/evaluations/phase-status/${solicitationId}/`).then((r) => r.data),

  listAppeals: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<any>>('/evaluations/award-appeals/', { params }).then((r) => r.data),

  getAppeal: (appealId: string) =>
    api.get<any>(`/evaluations/award-appeals/${appealId}/`).then((r) => r.data),

  getAppealEvidence: (appealId: string) =>
    api.get<any>(`/evaluations/award-appeals/${appealId}/evidence/`).then((r) => r.data),

  fileAppeal: (data: { solicitation: string; bidder: string; grounds: string; grounds_detail?: string; supporting_documents?: any[] }) =>
    api.post<any>('/evaluations/award-appeals/', data).then((r) => r.data),

  updateAppeal: (appealId: string, data: { status?: string; resolution?: string; action?: string; [key: string]: any }) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, data).then((r) => r.data),

  withdrawAppeal: (appealId: string) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, { status: 'withdrawn' }).then((r) => r.data),

  addReviewNotes: (appealId: string, notes: string) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, { action: 'add_review_notes', review_notes: notes }).then((r) => r.data),

  setHearingDate: (appealId: string, hearingDate: string) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, { action: 'set_hearing_date', hearing_date: hearingDate }).then((r) => r.data),

  requestClarification: (appealId: string, question: string) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, { action: 'request_clarification', clarification_request: question }).then((r) => r.data),

  respondClarification: (appealId: string, response: string) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, { clarification_response: response }).then((r) => r.data),

  resolveAppeal: (appealId: string, formData: FormData) =>
    api.patch<any>(`/evaluations/award-appeals/${appealId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  getAppealActionLogs: (appealId: string) =>
    api.get<any>(`/evaluations/award-appeals/${appealId}/action-logs/`).then((r) => r.data),
};
