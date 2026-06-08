import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Invoice, ThreeWayMatch } from '../../types';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ExclamationIcon,
  SearchIcon, DocumentTextIcon,
} from '@heroicons/react/outline';

interface LineMatch {
  line_number: number;
  item_name: string;
  item_code: string;
  po_qty: number;
  grn_qty: number;
  invoice_qty: number;
  po_price: number;
  grn_price: number;
  invoice_price: number;
  qty_match: boolean;
  price_match: boolean;
  grn_qty_match: boolean;
}

const DiscrepancyReview: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [action, setAction] = useState<'accept' | 'reject' | ''>('');

  const { data: invoicesData, isLoading, error } = useQuery({
    queryKey: ['invoices-for-discrepancy-review'],
    queryFn: () => financeApi.listInvoices({ status: 'pending_matching', page_size: 50 }),
  });

  const invoices: Invoice[] = invoicesData?.results || [];

  const { data: selectedInvoiceData, isError: detailError } = useQuery({
    queryKey: ['invoice-detail-discrepancy', selectedInvoice],
    queryFn: () => financeApi.getInvoice(selectedInvoice),
    enabled: !!selectedInvoice,
  });

  const selectedInv = selectedInvoiceData as Invoice | undefined;
  const matches = (selectedInv?.three_way_matches || []) as ThreeWayMatch[];
  const latestMatch: ThreeWayMatch | undefined = matches[matches.length - 1];
  const lineMatches: LineMatch[] = (latestMatch?.discrepancies as any)?.line_matches || [];
  const matchStatus = latestMatch?.match_status || '';

  const acceptMutation = useMutation({
    mutationFn: () => financeApi.acceptPartialInvoice(selectedInvoice, {
      approved_amount: parseFloat(approvedAmount),
      notes: reviewNotes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-for-discrepancy-review'] });
      toast.success('Partial match accepted. Invoice routed for adjusted approval.');
      setSelectedInvoice('');
      setAction('');
      setApprovedAmount('');
      setReviewNotes('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to accept'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => financeApi.rejectInvoice(selectedInvoice, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-for-discrepancy-review'] });
      toast.success('Invoice rejected');
      setSelectedInvoice('');
      setAction('');
      setRejectionReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to reject'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (error) return (
    <div className="max-w-6xl mx-auto py-12 text-center">
      <p className="text-gray-500">Failed to load invoice data. Please try again.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discrepancy Review</h1>
        <p className="text-sm text-gray-500 mt-1">Review and resolve 3-way match discrepancies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <SearchIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
              Invoices Pending Review
            </h2>
            {invoices.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500">No invoices pending discrepancy review</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id || inv.invoice_id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedInvoice === (inv.id || inv.invoice_id)
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => { setSelectedInvoice(inv.id || inv.invoice_id); setAction(''); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                        <p className="text-xs text-gray-500">{inv.contract_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">K {inv.amount?.toLocaleString()}</p>
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedInvoice && detailError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
              <p className="text-sm text-rose-700">Failed to load invoice details.</p>
            </div>
          )}

          {selectedInvoice && selectedInv && !detailError && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <ExclamationIcon className="w-6 h-6 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Item-Level Discrepancies</h2>
                <StatusBadge status={matchStatus} />
              </div>

              {lineMatches.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 font-semibold text-gray-600">Item</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">PO Qty</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">GRN Qty</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">Inv Qty</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-600">Qty Match</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">PO Price</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">GRN Price</th>
                        <th className="text-right py-3 px-2 font-semibold text-gray-600">Inv Price</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-600">Price Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineMatches.map((lm, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-3 px-2">
                            <p className="font-medium text-gray-900">{lm.item_name || `Line ${lm.line_number}`}</p>
                            {lm.item_code && <p className="text-xs text-gray-400">{lm.item_code}</p>}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-purple-700">{lm.po_qty}</td>
                          <td className="py-3 px-2 text-right">{lm.grn_qty}</td>
                          <td className="py-3 px-2 text-right">{lm.invoice_qty}</td>
                          <td className="py-3 px-2 text-center">
                            {lm.qty_match
                              ? <CheckCircleIcon className="w-5 h-5 text-emerald-500 inline" />
                              : <XCircleIcon className="w-5 h-5 text-rose-500 inline" />}
                            {!lm.grn_qty_match && lm.qty_match !== undefined && (
                              <span className="ml-1 text-xs text-amber-600" title="GRN qty mismatch">⚠</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-purple-700">K {lm.po_price?.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">K {lm.grn_price?.toLocaleString()}</td>
                          <td className="py-3 px-2 text-right">K {lm.invoice_price?.toLocaleString()}</td>
                          <td className="py-3 px-2 text-center">
                            {lm.price_match
                              ? <CheckCircleIcon className="w-5 h-5 text-emerald-500 inline" />
                              : <XCircleIcon className="w-5 h-5 text-rose-500 inline" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Header-level mismatch data (no line-item breakdown available)</p>
                  <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">
                    {JSON.stringify(latestMatch?.discrepancies || {}, null, 2)}
                  </pre>
                </div>
              )}

              {matchStatus === 'partial' && (
                <div className="mt-6 space-y-4">
                  {action === '' ? (
                    <div className="flex gap-3">
                      <button onClick={() => {
                        setAction('accept');
                        setApprovedAmount(String(selectedInv.amount || ''));
                      }}
                        className="flex-1 px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold hover:bg-zammsa-green-dark">
                        Accept Partial & Route for Approval
                      </button>
                      <button onClick={() => setAction('reject')}
                        className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700">
                        Reject Invoice
                      </button>
                    </div>
                  ) : action === 'accept' ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
                      <h3 className="font-bold text-gray-900">Accept Partial Match</h3>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Approved Payment Amount (ZMW) <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-4 top-3 text-gray-400 font-bold">K</span>
                          <input type="number" step="0.01" min="0" value={approvedAmount}
                            onChange={(e) => setApprovedAmount(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Original invoice amount: K {selectedInv.amount?.toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Review Notes</label>
                        <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none"
                          placeholder="Reason for accepting partial match..." />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || !approvedAmount}
                          className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold disabled:opacity-50">
                          {acceptMutation.isPending ? 'Processing...' : 'Confirm Acceptance'}
                        </button>
                        <button onClick={() => setAction('')}
                          className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 space-y-4">
                      <h3 className="font-bold text-gray-900">Reject Invoice</h3>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Rejection Reason <span className="text-rose-500">*</span></label>
                        <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                          placeholder="Reason for rejection..." required />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || !rejectionReason}
                          className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold disabled:opacity-50">
                          {rejectMutation.isPending ? 'Processing...' : 'Confirm Rejection'}
                        </button>
                        <button onClick={() => setAction('')}
                          className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {matchStatus === 'no_match' && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <ExclamationIcon className="w-5 h-5 text-rose-600 inline mr-2" />
                  <span className="text-sm font-medium text-rose-800">No match at all — invoice requires rejection or resubmission</span>
                  <div className="mt-3">
                    <div className="flex gap-3">
                      <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm"
                        placeholder="Rejection reason..." />
                      <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || !rejectionReason}
                        className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold disabled:opacity-50">
                        {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h2>
            {selectedInv ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{selectedInv.invoice_number}</span>
                </div>
                <p className="text-gray-500">Contract: {selectedInv.contract_number}</p>
                <p className="text-gray-500">Supplier: {selectedInv.supplier_name}</p>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-gray-500">Amount: <span className="font-bold text-gray-900">K {selectedInv.amount?.toLocaleString()}</span></p>
                  <p className="text-gray-500">Status: <StatusBadge status={selectedInv.status} /></p>
                  {selectedInv.suggested_approval_route && (
                    <p className="text-gray-500">Route: <span className="font-medium text-gray-900 capitalize">{selectedInv.suggested_approval_route.replace(/_/g, ' ')}</span></p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Select an invoice to view summary</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Thresholds</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">≤ K 100,000</span>
                <span className="font-medium text-gray-900">Finance Officer</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">≤ K 500,000</span>
                <span className="font-medium text-gray-900">Dept Head</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">&gt; K 500,000</span>
                <span className="font-medium text-gray-900">Director General</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscrepancyReview;
