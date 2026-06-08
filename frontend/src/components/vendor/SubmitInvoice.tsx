import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatContractValue, formatDate } from '../contracts/contractUtils';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/outline';

const RETENTION_RATE = 0.05;
const PAYMENT_TERMS = '30 days from invoice approval';

const SubmitInvoice: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedContract, setSelectedContract] = React.useState(contractId || '');
  const [selectedPo, setSelectedPo] = React.useState('');
  const [selectedMilestone, setSelectedMilestone] = React.useState('');
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [invoiceDate, setInvoiceDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState('');
  const [selectedGrn, setSelectedGrn] = React.useState('');
  const [invoiceFile, setInvoiceFile] = React.useState<File | null>(null);

  const { data: contractsData } = useQuery({
    queryKey: ['vendor-contracts-for-invoice-submit'],
    queryFn: () => vendorApi.contracts.list({ page_size: 100, status__in: 'active,pending_acceptance' }),
  });

  const activeContracts = (contractsData?.results || []).filter(
    (c: any) => c.status === 'active' || c.status === 'pending_acceptance'
  );

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['contract-financial-summary', selectedContract],
    queryFn: () => vendorApi.contracts.financialSummary(selectedContract),
    enabled: !!selectedContract,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['contract-purchase-orders', selectedContract],
    queryFn: () => vendorApi.invoices.purchaseOrders(selectedContract),
    enabled: !!selectedContract,
  });

  const grnsByContract = summary?.grns || [];

  const amountNum = parseFloat(amount) || 0;
  const retentionAmount = amountNum * RETENTION_RATE;
  const netPayable = amountNum - retentionAmount;

  useEffect(() => {
    if (contractId) {
      setSelectedContract(contractId);
    }
  }, [contractId]);

  const createAndSubmitMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('contract', selectedContract);
      if (invoiceNumber) form.append('invoice_number', invoiceNumber);
      form.append('amount', String(amountNum));
      if (invoiceDate) form.append('due_date', invoiceDate);
      if (selectedPo) form.append('po_number', selectedPo);
      if (selectedMilestone) form.append('milestone_name', selectedMilestone);
      if (selectedGrn) form.append('grn', selectedGrn);
      if (invoiceFile) form.append('document', invoiceFile);

      const created = await vendorApi.invoices.create(form);
      await vendorApi.invoices.submit(created.invoice_id);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast.success('Invoice submitted successfully for processing');
      navigate('/vendor/invoices', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.invoice_number?.[0] || 'Failed to submit invoice';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedContract) {
      toast.error('Please select a contract');
      return;
    }
    if (!amount || amountNum <= 0) {
      toast.error('Please enter a valid invoice amount');
      return;
    }
    if (!invoiceFile) {
      toast.error('Please upload the invoice PDF document');
      return;
    }

    createAndSubmitMutation.mutate();
  };

  const selectedContractSummary = activeContracts.find((c: any) => c.id === selectedContract || c.contract_id === selectedContract);

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/vendor/invoices" className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Invoice</h1>
          <p className="text-sm text-gray-500 mt-0.5">Submit an invoice against an active contract</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {selectedContract && summary && (
          <div className="bg-gradient-to-br from-zammsa-green/5 to-emerald-50 border border-zammsa-green/20 rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white/80 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Contract Value</p>
                <p className="text-xl font-black text-gray-900">{formatContractValue(summary.value, summary.currency)}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.contract_number}</p>
              </div>
              <div className="bg-white/80 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Payments to Date</p>
                <p className="text-xl font-black text-amber-600">{formatContractValue(summary.payments_to_date, summary.currency)}</p>
              </div>
              <div className="bg-white/80 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Balance</p>
                <p className="text-xl font-black text-zammsa-green">{formatContractValue(summary.balance, summary.currency)}</p>
              </div>
              <div className="bg-white/80 rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Status</p>
                <p className="text-lg font-black text-gray-900 capitalize">{summary.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Purchase Order & Milestone</h2>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Contract</label>
            <select
              value={selectedContract}
              onChange={(e) => { setSelectedContract(e.target.value); setSelectedPo(''); setSelectedMilestone(''); setSelectedGrn(''); }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
              required
            >
              <option value="">Select an active contract...</option>
              {activeContracts.map((c: any) => (
                <option key={c.id || c.contract_id} value={c.id || c.contract_id}>
                  {c.contract_number} — {c.title || 'Supply Contract'} ({formatContractValue(c.value, c.currency)})
                </option>
              ))}
            </select>
          </div>

          {purchaseOrders.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Purchase Order</label>
              <select
                value={selectedPo}
                onChange={(e) => setSelectedPo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
              >
                <option value="">Select a purchase order (optional)</option>
                {purchaseOrders.map((po: any) => (
                  <option key={po.id} value={po.po_number}>
                    {po.po_number} — K {po.total_amount?.toLocaleString()} ({po.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {summary && summary.milestones && summary.milestones.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Milestone</label>
              <select
                value={selectedMilestone}
                onChange={(e) => setSelectedMilestone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
              >
                <option value="">Select a milestone (optional)</option>
                {summary.milestones.map((m: any) => (
                  <option key={m.milestone_id} value={m.milestone_name}>
                    {m.milestone_name} — {formatDate(m.due_date)} ({m.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Invoice Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
                placeholder="e.g. INV-ABC-2026-045"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Amount (ZMW) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400 font-bold">K</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {summary && grnsByContract.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Goods Receipt Note</h2>
            <p className="text-sm text-gray-400 mb-4">Auto-linked from WMS delivery — select a GRN to reference</p>
            <select
              value={selectedGrn}
              onChange={(e) => setSelectedGrn(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
            >
              <option value="">Select a GRN (optional)</option>
              {grnsByContract.map((grn: any) => (
                <option key={grn.grn_id} value={grn.grn_id}>
                  {grn.grn_number} — {grn.item_description} (Qty: {grn.quantity_received}, K {Number(grn.total_amount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Invoice Document</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Invoice PDF <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`w-full border-2 border-dashed rounded-xl px-5 py-4 text-sm flex items-center justify-between transition-all ${invoiceFile ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${invoiceFile ? 'bg-zammsa-green/10' : 'bg-gray-100'}`}>
                    <svg className={`w-5 h-5 ${invoiceFile ? 'text-zammsa-green' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className={invoiceFile ? 'text-zammsa-green font-semibold' : 'text-gray-400'}>
                    {invoiceFile ? invoiceFile.name : 'Click to upload invoice PDF document'}
                  </span>
                </div>
                {invoiceFile && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setInvoiceFile(null); }}
                    className="text-xs text-red-500 font-bold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {amountNum > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Summary</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Invoice Amount</span>
                <span className="font-bold text-gray-900">K {amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Retention ({(RETENTION_RATE * 100).toFixed(0)}%) &mdash; withheld per contract terms
                </span>
                <span className="font-bold text-amber-600">
                  - K {retentionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-blue-200 pt-3 flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">Net Payable</span>
                <span className="text-xl font-black text-zammsa-green">
                  K {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-xs text-gray-400 italic pt-2">
                Payment Terms: {PAYMENT_TERMS}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <Link
            to="/vendor/invoices"
            className="px-6 py-3 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createAndSubmitMutation.isPending}
            className="px-10 py-3 bg-zammsa-green text-white rounded-xl font-bold hover:bg-zammsa-green-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zammsa-green/20 transition-all flex items-center gap-2"
          >
            {createAndSubmitMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Submitting...
              </>
            ) : (
              'Submit Invoice'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SubmitInvoice;
