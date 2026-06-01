import api from './client';
import { BudgetAllocation, BudgetEncumbrance, Invoice, GoodsReceiptNote, Payment, LetterOfCredit, PaginatedResponse } from '../types';

export const financeApi = {
  getBudgetAllocation: (id: string) =>
    api.get<BudgetAllocation>(`/finance/budget-allocations/${id}/`).then((r) => r.data),

  listBudgetAllocations: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<BudgetAllocation>>('/finance/budget-allocations/', { params }).then((r) => r.data),

  encumberBudget: (id: string, data: { amount: number; requisition: string }) =>
    api.post<{ message: string; encumbrance_id: string; amount: number; available: number }>(`/finance/budget-allocations/${id}/encumber/`, data).then((r) => r.data),

  releaseEncumbrance: (encumbranceId: string) =>
    api.post<{ message: string; encumbrance_id: string }>(`/finance/budget-allocations/${encumbranceId}/release/`).then((r) => r.data),

  syncBudgetFromErp: () =>
    api.post<{ message: string; created: number; updated: number; errors: number }>('/finance/budget-allocations/sync-from-erp/').then((r) => r.data),

  getBudgetSummary: (params?: Record<string, any>) =>
    api.get<{ total_allocated: number; total_encumbered: number; total_expended: number; total_available: number; allocation_count: number; fiscal_year: string }>('/finance/budget-allocations/summary/', { params }).then((r) => r.data),

  listEncumbrances: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<BudgetEncumbrance>>('/finance/encumbrances/', { params }).then((r) => r.data),

  listInvoices: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Invoice>>('/finance/invoices/', { params }).then((r) => r.data),

  getInvoice: (id: string) =>
    api.get<Invoice>(`/finance/invoices/${id}/`).then((r) => r.data),

  createInvoice: (data: Partial<Invoice>) =>
    api.post<Invoice>('/finance/invoices/', data).then((r) => r.data),

  submitInvoice: (id: string) =>
    api.post<{ message: string; status: string; approval_route?: string }>(`/finance/invoices/${id}/submit/`).then((r) => r.data),

  matchInvoice: (id: string, data?: {
    po_quantity?: number;
    grn_quantity?: number;
    invoice_quantity?: number;
    po_price?: number;
    invoice_price?: number;
  }) =>
    api.post<{ message: string; match_status: string; match: any; discrepancies: Record<string, any> }>(`/finance/invoices/${id}/match/`, data || {}).then((r) => r.data),

  approveInvoice: (id: string) =>
    api.post<{ message: string; status: string; approval_route: string }>(`/finance/invoices/${id}/approve/`).then((r) => r.data),

  rejectInvoice: (id: string, rejection_reason?: string) =>
    api.post<{ message: string; status: string }>(`/finance/invoices/${id}/reject/`, { rejection_reason }).then((r) => r.data),

  processPayment: (id: string, data: { amount: number; payment_method: string; reference?: string; vendor?: string }) =>
    api.post<{ message: string; payment_id?: string; status: string; iso20022_file_ref?: string; xml_content?: string }>(`/finance/invoices/${id}/pay/`, data).then((r) => r.data),

  bankConfirmPayment: (id: string, data: { status: string; reference?: string; paymentRef?: string; bank_reference?: string }) =>
    api.post<{ message: string; status: string; bank_reference: string }>(`/finance/invoices/${id}/bank-confirm/`, data).then((r) => r.data),

  sendPaymentAdvice: (id: string) =>
    api.post<{ message: string }>(`/finance/invoices/${id}/send-advice/`).then((r) => r.data),

  postToErp: (id: string) =>
    api.post<{ message: string }>(`/finance/invoices/${id}/post-erp/`).then((r) => r.data),

  listPayments: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<Payment>>('/finance/payments/', { params }).then((r) => r.data),

  listLettersOfCredit: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<LetterOfCredit>>('/finance/letters-of-credit/', { params }).then((r) => r.data),

  createLetterOfCredit: (data: Partial<LetterOfCredit>) =>
    api.post<LetterOfCredit>('/finance/letters-of-credit/', data).then((r) => r.data),

  getLetterOfCredit: (id: string) =>
    api.get<LetterOfCredit>(`/finance/letters-of-credit/${id}/`).then((r) => r.data),

  drawdownLetterOfCredit: (id: string, data: { amount: number }) =>
    api.post<{ message: string; lc_id: string; amount: number; status: string }>(`/finance/letters-of-credit/${id}/drawdown/`, data).then((r) => r.data),

  postGrnWebhook: (data: any) =>
    api.post<GoodsReceiptNote>('/finance/grn-webhook/', data).then((r) => r.data),

  listGrns: (params?: Record<string, any>) =>
    api.get<PaginatedResponse<GoodsReceiptNote>>('/finance/grns/', { params }).then((r) => r.data),
};
