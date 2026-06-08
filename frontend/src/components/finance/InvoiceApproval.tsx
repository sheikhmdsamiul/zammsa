import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ExclamationIcon,
  DocumentTextIcon, CashIcon,
} from '@heroicons/react/outline';

type BankOutcome = 'paid' | 'unpaid';

type PaymentArtifacts = {
  iso20022_file_ref?: string;
  pgp_encrypted_file_ref?: string;
  sftp_outbox_ref?: string;
  xml_content?: string;
};

const InvoiceApproval: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [decision, setDecision] = useState<'accept' | 'correct' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [approved, setApproved] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('iso20022');
  const [awaitingBankConfirmation, setAwaitingBankConfirmation] = useState(false);
  const [bankRef, setBankRef] = useState('');
  const [bankOutcome, setBankOutcome] = useState<BankOutcome>('paid');
  const [paymentAdviceSent, setPaymentAdviceSent] = useState(false);
  const [paymentArtifacts, setPaymentArtifacts] = useState<PaymentArtifacts | null>(null);

  const [matchResult, setMatchResult] = useState<any>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => financeApi.getInvoice(invoiceId!),
    enabled: !!invoiceId,
  });

  const matchMutation = useMutation({
    mutationFn: () => financeApi.matchInvoice(invoiceId!),
    onSuccess: (data: any) => {
      setMatchResult(data.match);
      toast.success('3-way match completed');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to perform 3-way match'),
  });

  const approveMutation = useMutation({
    mutationFn: () => financeApi.approveInvoice(invoiceId!),
    onSuccess: (data: any) => {
      const isFullyApproved = data.status === 'fully_approved' || data.status === 'approved';
      setApproved(isFullyApproved);
      toast.success(data.message || (isFullyApproved ? 'Invoice approved' : 'Approval step completed'));
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to approve invoice'),
  });

  const acceptPartialMutation = useMutation({
    mutationFn: () => {
      if (!invoice) throw new Error('Invoice not loaded');
      const grnQty = Number(displayMatch?.grn_qty || displayMatch?.grn_quantity || 0);
      const invoiceQty = Number(displayMatch?.invoice_qty || displayMatch?.invoice_quantity || 0);
      const invoiceUnitPrice = Number(displayMatch?.invoice_price || (invoiceQty ? invoice.amount / invoiceQty : invoice.amount));
      const adjustedAmount = grnQty > 0 && invoiceUnitPrice > 0
        ? Math.min(invoice.amount, grnQty * invoiceUnitPrice)
        : invoice.amount;
      return financeApi.acceptPartialInvoice(invoiceId!, {
        approved_amount: Number(adjustedAmount.toFixed(2)),
        notes: reason || 'Partial receipt accepted for adjusted payment.',
      });
    },
    onSuccess: (data: any) => {
      toast.success(data.message || 'Partial invoice accepted');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      setDecision(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to accept partial invoice'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => financeApi.rejectInvoice(invoiceId!, reason),
    onSuccess: () => {
      toast.success('Invoice rejected');
      navigate('/finance/invoices');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reject invoice'),
  });

  const requestCorrectionMutation = useMutation({
    mutationFn: () => financeApi.rejectInvoice(invoiceId!, reason || 'Correction requested'),
    onSuccess: () => {
      toast.success('Correction requested from supplier');
      navigate('/finance/invoices');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to request correction'),
  });

  const payMutation = useMutation({
    mutationFn: () => financeApi.processPayment(invoiceId!, {
      amount: invoice?.amount || 0,
      payment_method: paymentMethod,
      vendor: invoice?.supplier || '',
    }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Payment sent for bank processing');
      setPaymentArtifacts({
        iso20022_file_ref: data.iso20022_file_ref,
        pgp_encrypted_file_ref: data.pgp_encrypted_file_ref,
        sftp_outbox_ref: data.sftp_outbox_ref,
        xml_content: data.xml_content,
      });
      setPaymentProcessing(false);
      setBankRef('');
      setBankOutcome('paid');
      setAwaitingBankConfirmation(true);
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to process payment'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => financeApi.bankConfirmPayment(invoiceId!, {
      status: bankOutcome === 'paid' ? 'PAID' : 'FAILED',
      confirmed: bankOutcome === 'paid',
      paymentRef: bankRef,
      bank_reference: bankRef,
    }),
    onSuccess: () => {
      toast.success('Payment confirmed by bank');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to confirm payment'),
  });

  const manualConfirmMutation = useMutation({
    mutationFn: () => financeApi.manualConfirmPayment(invoiceId!, {
      bank_reference: bankRef || undefined,
      status: bankOutcome,
    }),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Payment confirmed manually');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to confirm payment'),
  });

  const sendAdviceMutation = useMutation({
    mutationFn: () => financeApi.sendPaymentAdvice(invoiceId!),
    onSuccess: () => {
      setPaymentAdviceSent(true);
      toast.success('Payment advice sent to supplier');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to send payment advice'),
  });

  const postToErpMutation = useMutation({
    mutationFn: () => financeApi.postToErp(invoiceId!),
    onSuccess: () => {
      toast.success('Payment posted to ERP');
      navigate('/finance/invoices');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to post to ERP'),
  });

  const handleConfirmDecision = () => {
    if (decision === 'reject') {
      rejectMutation.mutate();
    } else if (decision === 'correct') {
      requestCorrectionMutation.mutate();
    } else if (decision === 'accept') {
      approveMutation.mutate();
    }
  };

  if (isLoading) return <LoadingSpinner className="py-20" />;
  if (!invoice) return (
    <div className="max-w-5xl mx-auto py-20 text-center bg-white rounded-3xl shadow-sm border border-gray-100">
      <DocumentTextIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
      <p className="text-xl font-bold text-gray-500">Invoice not found</p>
      <button onClick={() => navigate('/finance/invoices')} className="mt-4 text-zammsa-green font-bold hover:underline">Back to Invoices</button>
    </div>
  );

  const isPaid = invoice.status === 'paid';
  const isRejected = invoice.status === 'rejected';
  const displayMatch = matchResult || (invoice.three_way_matches && invoice.three_way_matches.length > 0 ? invoice.three_way_matches[0] : null);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/finance/invoices')} className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1 transition-colors">
            ← Back to Invoices
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Invoice {invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-lg text-gray-500 mt-1 font-medium">Supplier: <span className="text-gray-900">{invoice.supplier_name || invoice.supplier || '-'}</span></p>
        </div>
        
        <div className="flex items-center gap-3">
          {invoice.document && (
            <button className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 shadow-sm transition-all flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5" /> View PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* 3-Way Match Section */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">3-Way Match Verification</h2>
                <p className="text-sm text-gray-500">Comparing Contract, Receipt, and Invoice</p>
              </div>
              {!displayMatch && (invoice.status === 'submitted' || invoice.status === 'pending_matching') && (
                <button 
                  onClick={() => matchMutation.mutate()} 
                  disabled={matchMutation.isPending}
                  className="px-6 py-2.5 bg-zammsa-green text-white rounded-xl font-bold hover:bg-zammsa-green-dark shadow-lg shadow-zammsa-green/20 transition-all"
                >
                  {matchMutation.isPending ? 'Verifying...' : 'Run 3-Way Match'}
                </button>
              )}
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">1. Contract / PO</span>
                  <p className="text-xl font-black text-blue-900">K {Number(invoice.contract_value || invoice.amount).toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1 font-medium">{invoice.contract_number}</p>
                </div>
                <div className="p-5 bg-purple-50/50 border border-purple-100 rounded-2xl">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block mb-1">2. Goods Receipt</span>
                  <p className="text-xl font-black text-purple-900">K {Number(invoice.grn_details?.total_amount || invoice.amount).toLocaleString()}</p>
                  <p className="text-xs text-purple-600 mt-1 font-medium">{invoice.grn_details?.grn_number || 'Awaiting Receipt'}</p>
                </div>
                <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-2xl">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">3. Supplier Invoice</span>
                  <p className="text-xl font-black text-amber-900">K {Number(invoice.amount).toLocaleString()}</p>
                  <p className="text-xs text-amber-600 mt-1 font-medium">{invoice.invoice_number}</p>
                </div>
              </div>

              {displayMatch ? (
                <div className="space-y-6">
                  {/* Detailed Comparison Table */}
                  <div className="overflow-hidden border border-gray-100 rounded-2xl">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Metric</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Contract / PO</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Goods Receipt</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Supplier Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        <tr>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">Quantity</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 font-medium">{Number(displayMatch.po_qty || displayMatch.po_quantity || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 font-medium">{Number(displayMatch.grn_qty || displayMatch.grn_quantity || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-sm font-black text-gray-900">{Number(displayMatch.invoice_qty || displayMatch.invoice_quantity || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">Unit Price / Value</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 font-medium">K {Number(displayMatch.po_price || invoice.contract_value || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 font-medium">K {Number(displayMatch.po_price || invoice.grn_details?.unit_price || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-sm font-black text-gray-900">K {Number(displayMatch.invoice_price || (invoice.amount / (displayMatch.invoice_qty || displayMatch.invoice_quantity || 1))).toLocaleString()}</td>
                        </tr>
                        <tr className="bg-zammsa-green/5">
                          <td className="px-6 py-4 text-sm font-bold text-zammsa-green">Total Impact</td>
                          <td className="px-6 py-4 text-right text-sm font-bold text-gray-600">K {Number((displayMatch.po_qty || displayMatch.po_quantity || 1) * (displayMatch.po_price || invoice.contract_value || 0)).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-sm font-bold text-gray-600">K {Number((displayMatch.grn_qty || displayMatch.grn_quantity || 1) * (displayMatch.po_price || invoice.grn_details?.unit_price || 0)).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-sm font-black text-zammsa-green">K {Number(invoice.amount).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Amount Verification', matched: displayMatch.invoice_vs_po || displayMatch.match_status === 'complete', detail: 'Invoice matches PO value' },
                      { label: 'Receipt Verification', matched: displayMatch.invoice_vs_grn || displayMatch.match_status === 'complete', detail: 'Invoice matches items received' },
                      { label: 'Quantity Check', matched: displayMatch.quantity_match || displayMatch.match_status === 'complete', detail: 'Units ordered = Units received = Units billed' },
                    ].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      item.matched ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        {item.matched ? (
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center">
                            <XCircleIcon className="w-5 h-5 text-rose-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.detail}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black uppercase tracking-widest ${item.matched ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.matched ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <ExclamationIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-medium">3-Way match has not been performed yet.</p>
                </div>
              )}
            </div>
          </div>

          {invoice.status === 'pending_matching' && displayMatch?.match_status === 'partial' && !isPaid && !isRejected && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8">
              <h2 className="text-xl font-bold text-amber-900 mb-2">Partial Match Review</h2>
              <p className="text-sm text-amber-800 mb-4">
                Goods received are lower than invoiced. Accepting partial routes an adjusted amount through approvals.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border border-amber-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-amber-500/10 outline-none"
                placeholder="Example: Pay for received quantities only; supplier to deliver the balance."
              />
              <button
                onClick={() => acceptPartialMutation.mutate()}
                disabled={acceptPartialMutation.isPending}
                className="mt-4 px-8 py-4 bg-amber-600 text-white rounded-2xl font-black text-sm hover:bg-amber-700 disabled:opacity-50 transition-all"
              >
                {acceptPartialMutation.isPending ? 'Routing...' : 'Accept Partial & Route Approval'}
              </button>
            </div>
          )}

          {/* Decision Section */}
          {invoice.status === 'pending_approval' && !approved && !isPaid && !isRejected && (
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 animate-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Final Review & Approval</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                  { id: 'accept', label: 'Approve', color: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' },
                  { id: 'correct', label: 'Request Correction', color: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' },
                  { id: 'reject', label: 'Reject Invoice', color: 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100' },
                ].map((opt) => (
                  <button 
                    key={opt.id}
                    onClick={() => setDecision(opt.id as any)}
                    className={`p-4 rounded-2xl border font-bold text-sm transition-all flex flex-col items-center gap-2 ${
                      decision === opt.id ? `ring-4 ring-offset-2 ring-zammsa-green ${opt.color}` : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${decision === opt.id ? 'bg-current' : 'bg-gray-200'}`}></span>
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-2">Reviewer Comments</label>
                <textarea 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  rows={4}
                  className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-zammsa-green/10 outline-none transition-all" 
                  placeholder="Provide details for your decision..." 
                />
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={handleConfirmDecision}
                  disabled={!decision || ((decision === 'reject' || decision === 'correct') && !reason)}
                  className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black shadow-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Confirm & Route
                </button>
              </div>
            </div>
          )}

          {/* Approved & Payment Section */}
          {(approved || invoice.status === 'approved' || invoice.status === 'fully_approved') && !paymentProcessing && !awaitingBankConfirmation && !isPaid && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-emerald-900 mb-2">Invoice Fully Approved</h3>
              <p className="text-emerald-700/70 max-w-sm mb-8">This invoice has cleared all internal approvals and is ready for disbursement.</p>
              
              <button 
                onClick={() => setPaymentProcessing(true)}
                className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-3"
              >
                <CashIcon className="w-6 h-6" />
                Initialize Payment Process
              </button>
            </div>
          )}

          {/* Payment Processing Form */}
          {paymentProcessing && (
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 animate-in zoom-in-95 duration-300">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)} 
                    className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-zammsa-green/10 outline-none"
                  >
                    <option value="electronic">EFT (Electronic Funds Transfer)</option>
                    <option value="iso20022">ISO 20022 XML (Direct Bank)</option>
                    <option value="cheque">Manual Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Amount to Pay</label>
                  <div className="relative">
                    <span className="absolute left-5 top-4 font-bold text-gray-400">K</span>
                    <input 
                      type="text" 
                      readOnly 
                      value={invoice.amount?.toLocaleString()} 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-5 py-4 text-sm font-black text-gray-900" 
                    />
                  </div>
                </div>
              </div>

              {paymentArtifacts && (
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">ISO 20022 File</p>
                    <p className="text-sm font-bold text-gray-900 break-all">{paymentArtifacts.iso20022_file_ref || '-'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">PGP Envelope</p>
                    <p className="text-sm font-bold text-gray-900 break-all">{paymentArtifacts.pgp_encrypted_file_ref || '-'}</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 md:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">SFTP Outbox</p>
                    <p className="text-sm font-bold text-gray-900 break-all">{paymentArtifacts.sftp_outbox_ref || '-'}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Target Account</p>
                    <p className="text-sm font-bold text-gray-700">{invoice.supplier_bank || 'Standard Chartered ****9821'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => payMutation.mutate()} 
                  disabled={payMutation.isPending}
                  className="px-8 py-4 bg-zammsa-green text-white rounded-2xl font-black text-sm hover:bg-zammsa-green-dark shadow-xl shadow-zammsa-green/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {payMutation.isPending ? 'Processing...' : 'Execute Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Success States: Confirmed, Posted, etc. */}
          {isPaid && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-10 text-center">
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
                <CheckCircleIcon className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-2">Disbursement Successful</h3>
              <p className="text-gray-500 max-w-sm mx-auto mb-8">The funds have been transferred and the ledger has been updated.</p>
              
              <div className="flex flex-wrap gap-4 justify-center">
                {!invoice.payment_advice_sent && !paymentAdviceSent && (
                  <button 
                    onClick={() => sendAdviceMutation.mutate()} 
                    disabled={sendAdviceMutation.isPending}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
                  >
                    {sendAdviceMutation.isPending ? 'Sending...' : 'Send Advice to Supplier'}
                  </button>
                )}
                {!invoice.erp_posted && (
                  <button 
                    onClick={() => postToErpMutation.mutate()} 
                    disabled={postToErpMutation.isPending}
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                  >
                    {postToErpMutation.isPending ? 'Posting...' : 'Post to ERP GL'}
                  </button>
                )}
                <button onClick={() => navigate('/finance/invoices')} className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all">
                  Return to List
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-2xl">
            <h2 className="text-lg font-bold mb-6 text-gray-400 uppercase tracking-widest">Financial Summary</h2>
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-gray-500 block mb-1">INVOICE AMOUNT</span>
                <p className="text-3xl font-black">K {invoice.amount?.toLocaleString()}</p>
              </div>
              <div className="pt-6 border-t border-gray-800 grid grid-cols-1 gap-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">PO Number</span><span className="font-bold text-gray-300">{invoice.po_number || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Contract</span><span className="font-bold text-gray-300 underline">{invoice.contract_number}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Currency</span><span className="font-bold text-gray-300">ZMW</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span className="font-bold text-gray-300">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Activity Log</h2>
            <div className="space-y-6">
              {[
                { label: 'Invoice Submitted', date: invoice.submitted_at, status: 'done' },
                { label: '3-Way Match', date: displayMatch ? invoice.updated_at : null, status: displayMatch ? 'done' : 'pending' },
                { label: 'Internal Approval', date: invoice.approved_at, status: invoice.approved_at ? 'done' : 'pending' },
                { label: 'Payment Executed', date: invoice.paid_at, status: invoice.paid_at ? 'done' : 'pending' },
              ].map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${step.status === 'done' ? 'bg-zammsa-green' : 'bg-gray-200'}`}></div>
                    {i < 3 && <div className="w-0.5 h-10 bg-gray-100 my-1"></div>}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${step.status === 'done' ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                    <p className="text-xs text-gray-400">{step.date ? new Date(step.date).toLocaleString() : 'Pending'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Awaiting Bank Confirmation Modal-like View */}
      {awaitingBankConfirmation && !isPaid && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-10 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CashIcon className="w-12 h-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 text-center mb-2">Awaiting Bank Response</h2>
            <p className="text-gray-500 text-center mb-8">Payment file has been transmitted. Capture the bank outcome once the confirmation arrives.</p>

            {paymentArtifacts && (
              <div className="grid grid-cols-1 gap-3 mb-6 text-left">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">ISO 20022 File</p>
                  <p className="text-sm font-bold text-blue-900 break-all">{paymentArtifacts.iso20022_file_ref || '-'}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">PGP Envelope</p>
                  <p className="text-sm font-bold text-blue-900 break-all">{paymentArtifacts.pgp_encrypted_file_ref || '-'}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">SFTP Outbox</p>
                  <p className="text-sm font-bold text-blue-900 break-all">{paymentArtifacts.sftp_outbox_ref || '-'}</p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Bank Outcome</label>
              <select
                value={bankOutcome}
                onChange={(e) => setBankOutcome(e.target.value as BankOutcome)}
                className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-5 py-4 text-sm font-black focus:border-zammsa-green outline-none transition-all"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid / Rejected</option>
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Bank Reference Number</label>
              <input 
                value={bankRef} 
                onChange={(e) => setBankRef(e.target.value)}
                className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-5 py-4 text-sm font-black focus:border-zammsa-green outline-none transition-all" 
                placeholder="e.g. TRF-9921-001-X" 
              />
            </div>
            
            <div className="flex gap-3 mb-3">
              <button 
                onClick={() => confirmMutation.mutate()} 
                disabled={!bankRef || confirmMutation.isPending}
                className="flex-1 py-4 bg-zammsa-green text-white rounded-2xl font-black shadow-lg shadow-zammsa-green/20 disabled:opacity-30 transition-all"
              >
                {confirmMutation.isPending ? 'Confirming...' : `Confirm via Bank Webhook (${bankOutcome})`}
              </button>
              <button onClick={() => setAwaitingBankConfirmation(false)} className="px-6 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors">
                Later
              </button>
            </div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
              <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold shrink-0">Testing</span>
              <button
                onClick={() => manualConfirmMutation.mutate()}
                disabled={manualConfirmMutation.isPending}
                className="text-sm font-bold text-amber-800 hover:underline"
              >
                {manualConfirmMutation.isPending ? 'Confirming...' : `Manual Confirm (${bankOutcome})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceApproval;
