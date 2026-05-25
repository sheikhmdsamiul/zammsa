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
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [bankRef, setBankRef] = useState('');

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
    onSuccess: () => {
      setApproved(true);
      toast.success('Invoice approved');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => financeApi.rejectInvoice(invoiceId!, reason),
    onSuccess: () => {
      toast.success('Invoice rejected');
      navigate('/finance/invoices');
    },
  });

  const payMutation = useMutation({
    mutationFn: () => financeApi.processPayment(invoiceId!, {
      amount: invoice?.amount || 0,
      payment_method: paymentMethod,
      vendor: invoice?.supplier || '',
    }),
    onSuccess: (data: any) => {
      toast.success('Payment processed');
      setPaymentProcessing(false);
      setPaymentConfirmed(true);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => financeApi.bankConfirmPayment(invoiceId!, {
      status: 'confirmed',
      reference: bankRef,
    }),
    onSuccess: () => {
      toast.success('Payment confirmed by bank');
      navigate('/finance/invoices');
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (!invoice) return <p className="text-center text-gray-500 py-12">Invoice not found</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Supplier: {invoice.supplier || 'Lusaka Reagents Ltd'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3-Way Match Results</h2>
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
                    <td className="px-4 py-3 font-medium">HIV Test Kits</td>
                    <td className="px-4 py-3 text-right">500 boxes ✅</td>
                    <td className="px-4 py-3 text-right">500 boxes ✅</td>
                    <td className="px-4 py-3 text-right">500 boxes ✅</td>
                  </tr>
                  <tr className="bg-amber-50">
                    <td className="px-4 py-3 font-medium">CD4 Reagents</td>
                    <td className="px-4 py-3 text-right">100 kits ✅</td>
                    <td className="px-4 py-3 text-right">98 kits ⚠</td>
                    <td className="px-4 py-3 text-right text-rose-600 font-medium">100 kits ❌</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`p-4 rounded-lg ${invoice.status === 'pending_matching' ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className="text-sm font-medium">
                Match Status: <span className="font-bold">{invoice.status === 'pending_matching' ? '🟡 PARTIAL MATCH' : '✅ COMPLETE'}</span>
              </p>
              {invoice.status === 'pending_matching' && (
                <div className="mt-2 text-sm text-amber-800">
                  <p>Discrepancy: CD4 — GRN: 98, Invoice: 100 (2 units short)</p>
                  <p>Disputed Value: 2 × K10,400 = K 20,800</p>
                  <p>LD Applied: K 5,775 (1 week late delivery)</p>
                  <p className="font-semibold mt-2">Net Payable: K 1,072,004</p>
                </div>
              )}
              {invoice.status === 'pending_matching' && (
                <button onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}
                  className="mt-3 px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {matchMutation.isPending ? 'Matching...' : 'Run 3-Way Match'}
                </button>
              )}
            </div>
          </div>

          {invoice.status !== 'pending_matching' && decision === null && !approved && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Decision</h2>
              <div className="space-y-3">
                {[
                  { value: 'accept', label: 'Accept partial — pay for 98 CD4 kits. Supplier delivers 2 outstanding.' },
                  { value: 'correct', label: 'Request supplier resubmit corrected invoice for 98 units.' },
                  { value: 'reject', label: 'Reject invoice — supplier must re-deliver all items first.' },
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                  className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="Accept partial payment..." />
              </div>

              <button onClick={() => {
                if (decision === 'reject') { rejectMutation.mutate(); }
                else { approveMutation.mutate(); }
              }} disabled={!decision || !reason}
                className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                Confirm Decision
              </button>
            </div>
          )}

          {approved && !paymentProcessing && !paymentConfirmed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <CheckCircleIcon className="w-8 h-8 text-emerald-500 mb-2" />
              <h3 className="text-lg font-semibold text-emerald-800 mb-4">Invoice Approved</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg text-sm">
                  <span className="text-gray-600">Finance Officer approved</span>
                  <span className="font-medium">P. Mwale ✅</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg text-sm">
                  <span className="text-gray-600">Dept Head approved</span>
                  <span className="font-medium">J. Tembo ✅</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg text-sm">
                  <span className="text-gray-600">DG approval required (&gt;K500,000)</span>
                  <span className="font-medium">C. Banda ✅</span>
                </div>
              </div>
              <button onClick={() => setPaymentProcessing(true)}
                className="mt-4 px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold">
                Proceed to Payment
              </button>
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
              <p className="text-sm font-bold">Lusaka Reagents Ltd</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Amount</p>
              <p className="text-sm font-bold">K {invoice.amount?.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Bank</p>
              <p className="text-sm font-bold">Zanaco Plc</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Account</p>
              <p className="text-sm font-bold font-mono">••••••••7823</p>
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
            {payMutation.isPending ? 'Processing...' : 'Generate Payment File & Send to Bank'}
          </button>
        </div>
      )}

      {paymentConfirmed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Payment Processed Successfully</h2>
          <div className="max-w-md mx-auto bg-white rounded-xl p-6 text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Bank Reference</span><span className="font-medium">ZNB-2026-PAY-7821</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">K {invoice.amount?.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-emerald-600">✅ PAID</span></div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Confirmation Reference</label>
            <input value={bankRef} onChange={(e) => setBankRef(e.target.value)} className="w-64 border rounded-lg px-4 py-2 text-sm" placeholder="Enter bank reference..." />
          </div>
          <button onClick={() => confirmMutation.mutate()} disabled={!bankRef || confirmMutation.isPending}
            className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold disabled:opacity-50">
            Confirm Payment & Update ERP
          </button>
        </div>
      )}
    </div>
  );
};

export default InvoiceApproval;
