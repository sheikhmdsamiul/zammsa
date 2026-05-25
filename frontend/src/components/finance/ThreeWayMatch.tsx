import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, SearchIcon,
  DocumentTextIcon, ClipboardListIcon, CashIcon,
} from '@heroicons/react/outline';

const ThreeWayMatch: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [matched, setMatched] = useState(false);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices-for-match'],
    queryFn: () => financeApi.listInvoices({ status: 'pending_match', page_size: 50 }),
  });

  const invoices = invoicesData?.results || [];

  const { data: selectedInvoiceData } = useQuery({
    queryKey: ['invoice-detail', selectedInvoice],
    queryFn: () => financeApi.getInvoice(selectedInvoice),
    enabled: !!selectedInvoice,
  });

  const matchMutation = useMutation({
    mutationFn: () => financeApi.matchInvoice(selectedInvoice),
    onSuccess: (data: any) => {
      setMatchResult(data.match);
      toast.success('3-way match completed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Match failed'),
  });

  const approveMutation = useMutation({
    mutationFn: () => financeApi.approveInvoice(selectedInvoice),
    onSuccess: () => {
      setMatched(true);
      queryClient.invalidateQueries({ queryKey: ['invoices-for-match'] });
      toast.success('Invoice approved after 3-way match');
    },
    onError: () => toast.error('Failed to approve invoice'),
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (matched) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircleIcon className="w-16 h-16 text-zammsa-green mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">3-Way Match Complete</h2>
          <p className="text-gray-500 mb-6">Invoice approved for payment processing</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/finance/payments')} className="px-6 py-3 bg-zammsa-green text-white rounded-xl font-bold">
              Proceed to Payment
            </button>
            <button onClick={() => navigate('/finance/invoices')} className="px-6 py-3 bg-white border border-gray-300 rounded-xl font-bold">
              Back to Invoices
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">3-Way Matching</h1>
            <StatusBadge status={matchResult ? 'active' : 'draft'} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Match Invoice ↔ Purchase Order ↔ Goods Receipt Note</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <SearchIcon className="w-5 h-5 inline mr-2 text-zammsa-green" />
              Select Invoice
            </h2>
            {invoices.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500">No invoices pending 3-way match</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv: any) => (
                  <div key={inv.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedInvoice === inv.id
                        ? 'border-zammsa-green bg-zammsa-green/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => { setSelectedInvoice(inv.id); setMatchResult(null); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{inv.invoice_number || `INV-${inv.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-gray-500">{inv.contract || inv.vendor_name}</p>
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

          {selectedInvoice && selectedInvoiceData && !matchResult && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Matching Details</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <DocumentTextIcon className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-blue-900">Invoice</p>
                  <p className="text-xs text-blue-700">K {(selectedInvoiceData as any).amount?.toLocaleString()}</p>
                  <p className="text-xs text-blue-600">{(selectedInvoiceData as any).invoice_number}</p>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <ClipboardListIcon className="w-6 h-6 text-purple-600 mb-2" />
                  <p className="text-sm font-medium text-purple-900">PO / Contract</p>
                  <p className="text-xs text-purple-700">K {(selectedInvoiceData as any).contract_value || (selectedInvoiceData as any).amount?.toLocaleString()}</p>
                  <p className="text-xs text-purple-600">{(selectedInvoiceData as any).contract || 'N/A'}</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CashIcon className="w-6 h-6 text-emerald-600 mb-2" />
                  <p className="text-sm font-medium text-emerald-900">GRN</p>
                  <p className="text-xs text-emerald-700">K {(selectedInvoiceData as any).grn_value || (selectedInvoiceData as any).amount?.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600">{(selectedInvoiceData as any).grn_number || 'Pending'}</p>
                </div>
              </div>
              <button onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}
                className="w-full px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {matchMutation.isPending ? 'Matching...' : 'Run 3-Way Match'}
              </button>
            </div>
          )}

          {matchResult && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Match Results</h2>
              <div className="space-y-3">
                {([
                  { label: 'Invoice Amount vs PO Value', status: (matchResult as any).invoice_vs_po, detail: `K ${(matchResult as any).invoice_amount?.toLocaleString()} vs K ${(matchResult as any).po_amount?.toLocaleString()}` },
                  { label: 'PO Value vs GRN Value', status: (matchResult as any).po_vs_grn, detail: `K ${(matchResult as any).po_amount?.toLocaleString()} vs K ${(matchResult as any).grn_amount?.toLocaleString()}` },
                  { label: 'Invoice vs GRN', status: (matchResult as any).invoice_vs_grn, detail: `K ${(matchResult as any).invoice_amount?.toLocaleString()} vs K ${(matchResult as any).grn_amount?.toLocaleString()}` },
                  { label: 'Quantity Verification', status: (matchResult as any).quantity_match, detail: `${(matchResult as any).invoice_qty || 0} vs ${(matchResult as any).grn_qty || 0} units` },
                ]).map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${
                    item.status ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
                  }`}>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.detail}</p>
                    </div>
                    {item.status ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                        <CheckCircleIcon className="w-5 h-5" /> Match
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-600 text-sm font-medium">
                        <XCircleIcon className="w-5 h-5" /> Mismatch
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-medium text-gray-900">Match Status</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(matchResult as any).overall_match
                    ? 'All checks passed. Invoice can be approved.'
                    : (matchResult as any).flag_for_review
                      ? 'Flagged for review due to discrepancies.'
                      : 'Discrepancies found. Manual review required.'}
                </p>
              </div>

              {(matchResult as any).overall_match && (
                <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                  className="mt-4 w-full px-6 py-3 bg-zammsa-green text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {approveMutation.isPending ? 'Approving...' : 'Approve Invoice After Match'}
                </button>
              )}

              {!(matchResult as any).overall_match && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">Invoice flagged for manual review</p>
                  <p className="text-xs text-amber-700 mt-1">Discrepancies found. Contact procurement for resolution.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How 3-Way Match Works</h2>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Invoice</p>
                  <p className="text-xs text-gray-500">Supplier submits invoice</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-purple-700 font-bold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Purchase Order</p>
                  <p className="text-xs text-gray-500">Matches against contract/PO</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-emerald-700 font-bold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Goods Receipt Note</p>
                  <p className="text-xs text-gray-500">Matches against goods received</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeWayMatch;
