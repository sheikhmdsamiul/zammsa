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

const InvoiceApproval: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [decision, setDecision] = useState<'accept' | 'correct' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [approved, setApproved] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('electronic');
  const [awaitingBankConfirmation, setAwaitingBankConfirmation] = useState(false);
  const [bankRef, setBankRef] = useState('');
  const [paymentAdviceSent, setPaymentAdviceSent] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => financeApi.getInvoice(invoiceId!),
    enabled: !!invoiceId,
  });

  const matchMutation = useMutation({
    mutationFn: () => financeApi.matchInvoice(invoiceId!),
    onSuccess: (data: any) => {
      toast.success('3-way match completed');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => financeApi.approveInvoice(invoiceId!),
    onSuccess: (data: any) => {
      const isFullyApproved = data.status === 'approved';
      setApproved(isFullyApproved);
      toast.success(data.message || (isFullyApproved ? 'Invoice approved' : 'Approval step completed'));
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to approve invoice'),
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
      setPaymentProcessing(false);
      setAwaitingBankConfirmation(true);
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to process payment'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => financeApi.bankConfirmPayment(invoiceId!, {
      status: 'PAID',
      paymentRef: bankRef,
      bank_reference: bankRef,
    }),
    onSuccess: () => {
      toast.success('Payment confirmed by bank');
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

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!invoice) return (
    <div className="max-w-5xl mx-auto py-12 text-center">
      <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p className="text-lg font-bold text-gray-500">Invoice not found</p>
    </div>
  );

  const isPaid = invoice.status === 'paid';
  const isRejected = invoice.status === 'rejected';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Supplier: {invoice.supplier || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3-Way Match Results</h2>
            {invoice.grn_details ? (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Item</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">PO Ordered</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">GRN Received</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Invoice Claimed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 font-medium">{invoice.grn_details.item_description || '-'}</td>
                      <td className="px-4 py-3 text-right">{invoice.po_number ? `${invoice.po_number}` : '-'}</td>
                      <td className="px-4 py-3 text-right">{invoice.grn_details.grn_number || '-'}</td>
                      <td className="px-4 py-3 text-right">{invoice.invoice_number}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No GRN data available for matching.</p>
            )}

            <div className={`p-4 rounded-lg ${invoice.status === 'pending_matching' ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className="text-sm font-medium">
                Match Status: <span className="font-bold">{invoice.status === 'pending_matching' ? 'PENDING' : 'Complete'}</span>
              </p>
            </div>

            {(invoice.status === 'submitted' || invoice.status === 'pending_matching') && (
              <button onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}
                className="mt-3 px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {matchMutation.isPending ? 'Matching...' : 'Run 3-Way Match'}
              </button>
            )}
          </div>

          {invoice.status === 'pending_approval' && decision === null && !approved && !isPaid && !isRejected && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Decision</h2>
              <div className="space-y-3">
                {[
                  { value: 'accept', label: 'Accept invoice and proceed with approval.' },
                  { value: 'correct', label: 'Request supplier resubmit corrected invoice.' },
                  { value: 'reject', label: 'Reject invoice.' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                    <input type="radio" name="decision" value={opt.value}
                      checked={decision === opt.value} onChange={() => setDecision(opt.value as any)}
                      className="mt-1 text-zammsa-green" />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason {decision === 'reject' || decision === 'correct' ? '(required)' : '(optional)'}
                </label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                  className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="Enter reason for decision..." />
              </div>

              <button onClick={handleConfirmDecision}
                disabled={!decision || ((decision === 'reject' || decision === 'correct') && !reason)}
                className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                Confirm Decision
              </button>
            </div>
          )}

          {(approved || invoice.status === 'approved') && !paymentProcessing && !awaitingBankConfirmation && !paymentAdviceSent && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <CheckCircleIcon className="w-8 h-8 text-emerald-500 mb-2" />
              <h3 className="text-lg font-semibold text-emerald-800 mb-4">Invoice Approved</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg text-sm">
                  <span className="text-gray-600">Approval route</span>
                  <span className="font-medium">{invoice.approval_route || '-'}</span>
                </div>
              </div>
              <button onClick={() => setPaymentProcessing(true)}
                className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
                Proceed to Payment
              </button>
            </div>
          )}

          {isPaid && !paymentAdviceSent && !invoice.payment_advice_sent && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-emerald-800 mb-4">Payment Completed</h3>
              <div className="flex gap-3">
                <button onClick={() => sendAdviceMutation.mutate()} disabled={sendAdviceMutation.isPending}
                  className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {sendAdviceMutation.isPending ? 'Sending...' : 'Send Payment Advice'}
                </button>
                {!invoice.erp_posted && (
                  <button onClick={() => postToErpMutation.mutate()} disabled={postToErpMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                    {postToErpMutation.isPending ? 'Posting...' : 'Post to ERP'}
                  </button>
                )}
              </div>
            </div>
          )}

          {paymentAdviceSent && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
              <CheckCircleIcon className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-800">Payment advice sent to supplier</p>
              {!invoice.erp_posted && (
                <button onClick={() => postToErpMutation.mutate()} disabled={postToErpMutation.isPending}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {postToErpMutation.isPending ? 'Posting...' : 'Post to ERP'}
                </button>
              )}
            </div>
          )}

          {isRejected && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
              <XCircleIcon className="w-8 h-8 text-rose-500 mb-2" />
              <h3 className="text-lg font-semibold text-rose-800 mb-2">Invoice Rejected</h3>
              {invoice.rejection_reason && (
                <p className="text-sm text-rose-700">Reason: {invoice.rejection_reason}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-gray-500">Amount</dt><dd className="font-bold text-lg">K {invoice.amount?.toLocaleString()}</dd></div>
              <div><dt className="text-gray-500">Submitted</dt><dd className="font-medium">{invoice.submitted_at ? new Date(invoice.submitted_at).toLocaleDateString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Due Date</dt><dd className="font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd><StatusBadge status={invoice.status} /></dd></div>
            </dl>
          </div>
        </div>
      </div>

      {paymentProcessing && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Process Payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Pay To</p>
              <p className="text-sm font-bold">{invoice.supplier || '-'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Amount</p>
              <p className="text-sm font-bold">K {invoice.amount?.toLocaleString()}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded-lg px-4 py-2 text-sm">
              <option value="electronic">Electronic Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="iso20022">ISO 20022 XML</option>
            </select>
          </div>

          <button onClick={() => payMutation.mutate()} disabled={payMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            <CashIcon className="w-5 h-5" />
            {payMutation.isPending ? 'Processing...' : 'Generate Payment File and Send to Bank'}
          </button>
        </div>
      )}

      {awaitingBankConfirmation && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Payment Sent to Bank</h2>
          <div className="max-w-md mx-auto bg-white rounded-xl p-6 text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Bank Reference</span><span className="font-medium">Awaiting confirmation</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">K {invoice.amount?.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-amber-600">Sent to bank</span></div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Confirmation Reference</label>
            <input value={bankRef} onChange={(e) => setBankRef(e.target.value)}
              className="w-64 border rounded-lg px-4 py-2 text-sm" placeholder="Enter bank reference..." />
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => confirmMutation.mutate()} disabled={!bankRef || confirmMutation.isPending}
              className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold disabled:opacity-50">
              {confirmMutation.isPending ? 'Confirming...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}

      {confirmMutation.isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Payment Confirmed</h2>
          <p className="text-sm text-emerald-700 mb-4">Bank reference: {bankRef}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => sendAdviceMutation.mutate()} disabled={sendAdviceMutation.isPending}
              className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold disabled:opacity-50">
              {sendAdviceMutation.isPending ? 'Sending...' : 'Send Payment Advice'}
            </button>
            {!invoice.erp_posted && (
              <button onClick={() => postToErpMutation.mutate()} disabled={postToErpMutation.isPending}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">
                {postToErpMutation.isPending ? 'Posting...' : 'Post to ERP'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceApproval;
