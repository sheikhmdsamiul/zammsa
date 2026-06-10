import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatContractValue, formatDate } from '../contracts/contractUtils';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, ExclamationIcon, CheckCircleIcon } from '@heroicons/react/outline';
import { AvailableGRN, GRNLineItemInfo } from '../../types';

const SubmitInvoice: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedContract, setSelectedContract] = useState(contractId || '');
  const [selectedGRN, setSelectedGRN] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineQtyOverrides, setLineQtyOverrides] = useState<Record<number, number>>({});
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [deliveryNoteFile, setDeliveryNoteFile] = useState<File | null>(null);
  const [zamraCertFile, setZamraCertFile] = useState<File | null>(null);
  const [tempLogFile, setTempLogFile] = useState<File | null>(null);
  const [bankConfirmSame, setBankConfirmSame] = useState(true);
  const [updateBankName, setUpdateBankName] = useState('');
  const [updateBankAccount, setUpdateBankAccount] = useState('');
  const [updateBankHolder, setUpdateBankHolder] = useState('');
  const [bankLetterFile, setBankLetterFile] = useState<File | null>(null);

  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['vendor-contracts-for-invoice-submit'],
    queryFn: () => vendorApi.contracts.list({ page_size: 100, status: 'active' }),
  });

  const activeContracts = (contractsData?.results || []).filter((c: any) => c.status === 'active');

  const { data: summary } = useQuery({
    queryKey: ['contract-financial-summary', selectedContract],
    queryFn: () => vendorApi.contracts.financialSummary(selectedContract),
    enabled: !!selectedContract,
  });

  const { data: profile } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: () => vendorApi.profile.get(),
  });

  const { data: availableGRNs = [], isLoading: grnsLoading } = useQuery({
    queryKey: ['contract-available-grns', selectedContract],
    queryFn: () => vendorApi.contracts.availableGRNs(selectedContract),
    enabled: !!selectedContract,
  });

  const selectedGRNData = availableGRNs.find((g: any) => g.grn_id === selectedGRN) as AvailableGRN | undefined;

  const lineItems = useMemo(() => {
    if (!selectedGRNData) return [];
    return selectedGRNData.line_items.map((li) => ({
      ...li,
      invoiceQty: lineQtyOverrides[li.line_number] ?? li.quantity_received,
    }));
  }, [selectedGRNData, lineQtyOverrides]);

  const overageWarnings = useMemo(() => {
    return lineItems
      .filter((li) => li.invoiceQty > li.quantity_received)
      .map((li) => ({
        item: li.item_name || li.item_code,
        invoiceQty: li.invoiceQty,
        grnQty: li.quantity_received,
      }));
  }, [lineItems]);

  const totalInvoiceAmount = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + li.invoiceQty * li.unit_price, 0);
  }, [lineItems]);

  const retentionAmount = totalInvoiceAmount * 0.05;
  const netPayable = totalInvoiceAmount - retentionAmount;

  useEffect(() => {
    if (contractId) {
      setSelectedContract(contractId);
    }
  }, [contractId]);

  useEffect(() => {
    setSelectedGRN('');
    setLineQtyOverrides({});
    setInvoiceFile(null);
    setDeliveryNoteFile(null);
    setZamraCertFile(null);
    setTempLogFile(null);
  }, [selectedContract]);

  useEffect(() => {
    if (selectedGRNData && !invoiceNumber) {
      const grnNum = selectedGRNData.grn_number.replace(/[^a-zA-Z0-9]/g, '');
      setInvoiceNumber(`INV-${grnNum}-${Date.now().toString(36).toUpperCase()}`);
    }
  }, [selectedGRNData]);

  const createAndSubmitMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('contract', selectedContract);
      if (selectedGRN) form.append('grn', selectedGRN);
      if (invoiceNumber) form.append('invoice_number', invoiceNumber);
      form.append('amount', String(totalInvoiceAmount));
      form.append('original_amount', String(totalInvoiceAmount));

      form.append('line_items_data', JSON.stringify(
        lineItems.map((li, idx) => ({
          line_number: idx + 1,
          item_code: li.item_code,
          item_name: li.item_name,
          quantity: li.invoiceQty,
          unit_price: li.unit_price,
          total_amount: li.invoiceQty * li.unit_price,
          grn_line_item_id: li.line_item_id,
        }))
      ));

      if (invoiceFile) form.append('document', invoiceFile);
      if (deliveryNoteFile) form.append('delivery_note', deliveryNoteFile);
      if (zamraCertFile) form.append('zamra_certificate', zamraCertFile);
      if (tempLogFile) form.append('temperature_log', tempLogFile);

      const created = await vendorApi.invoices.create(form);
      await vendorApi.invoices.submit(created.invoice_id);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast.success('Invoice submitted successfully. 30-day payment deadline started.');
      navigate('/vendor/invoices', { replace: true });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.invoice_number?.[0] || 'Failed to submit invoice';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract) { toast.error('Please select a contract'); return; }
    if (!selectedGRN) { toast.error('Please select a delivery note (GRN) to invoice against'); return; }
    if (lineItems.length === 0) { toast.error('No line items available from the selected GRN'); return; }
    if (overageWarnings.length > 0) {
      const msg = overageWarnings.map((w) => `${w.item}: invoices ${w.invoiceQty} but GRN confirms ${w.grnQty}`).join('; ');
      toast.error(`Invoice quantity exceeds GRN for: ${msg}`);
      return;
    }
    if (!invoiceFile) { toast.error('Please upload the invoice PDF document'); return; }
    if (totalInvoiceAmount <= 0) { toast.error('Invoice amount must be greater than zero'); return; }
    createAndSubmitMutation.mutate();
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/vendor/invoices" className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Invoice</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and submit an invoice against delivered goods</p>
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
          <h2 className="text-lg font-bold text-gray-900 mb-6">Invoice Header</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contract <span className="text-rose-500">*</span></label>
              {contractsLoading ? (
                <LoadingSpinner className="py-3" />
              ) : (
                <select
                  value={selectedContract}
                  onChange={(e) => { setSelectedContract(e.target.value); }}
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
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number <span className="text-rose-500">*</span></label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
                placeholder="Auto-generated or enter your own"
                required
              />
            </div>
          </div>
        </div>

        {selectedContract && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Select Delivery Note (GRN)</h2>
            <p className="text-sm text-gray-400 mb-4">
              Choose a goods receipt note with COMPLETE or PARTIAL status to invoice against.
              Only GRNs without an existing invoice are shown.
            </p>
            {grnsLoading ? (
              <LoadingSpinner className="py-8" />
            ) : availableGRNs.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                No available GRNs for this contract. Goods must be delivered and receipted before you can invoice.
              </div>
            ) : (
              <select
                value={selectedGRN}
                onChange={(e) => { setSelectedGRN(e.target.value); setLineQtyOverrides({}); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
                required
              >
                <option value="">Select a delivery note...</option>
                {availableGRNs.map((grn: any) => (
                  <option key={grn.grn_id} value={grn.grn_id}>
                    {grn.grn_number}  {formatDate(grn.received_date)}  {grn.status.toUpperCase()} ({grn.quantity_received} units, K {Number(grn.total_amount).toLocaleString()})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {selectedGRNData && lineItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Item</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-600">GRN Qty</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-600">Invoice Qty</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-600">Unit Price</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-600">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.line_number} className="border-b border-gray-100">
                      <td className="py-3 px-2 font-medium">{li.item_name || li.item_code}</td>
                      <td className="py-3 px-2 text-right">{li.quantity_received.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max={li.quantity_received}
                          step="1"
                          value={li.invoiceQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLineQtyOverrides((prev) => ({ ...prev, [li.line_number]: val }));
                          }}
                          className={`w-24 text-right border rounded-lg px-2 py-1 text-sm ${
                            li.invoiceQty > li.quantity_received
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-gray-200'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-2 text-right">K {li.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-2 text-right font-semibold">
                        K {(li.invoiceQty * li.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={4} className="py-3 px-2 text-right font-bold text-gray-900">TOTAL</td>
                    <td className="py-3 px-2 text-right font-bold text-gray-900">
                      K {totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {overageWarnings.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <ExclamationIcon className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-800">Quantity exceeds GRN confirmation</p>
                    {overageWarnings.map((w, i) => (
                      <p key={i} className="text-sm text-red-700 mt-1">
                        Invoice claims {w.invoiceQty} {w.item} but GRN confirms only {w.grnQty} received.
                        You may only invoice for quantities confirmed in the GRN.
                        Please correct or explain the discrepancy.
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Attachments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileUpload
              label="Invoice PDF *"
              accept=".pdf"
              file={invoiceFile}
              onChange={setInvoiceFile}
              required
            />
            <FileUpload
              label="Delivery Note / Packing List"
              accept=".pdf,.jpg,.png"
              file={deliveryNoteFile}
              onChange={setDeliveryNoteFile}
            />
            <FileUpload
              label="ZAMRA Batch Certificates"
              accept=".pdf"
              file={zamraCertFile}
              onChange={setZamraCertFile}
            />
            <FileUpload
              label="Temperature Log"
              accept=".pdf,.jpg,.png"
              file={tempLogFile}
              onChange={setTempLogFile}
            />
          </div>
        </div>

        {profile && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Bank Details Confirmation</h2>

            {profile.bank_name ? (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{profile.bank_name}</p>
                    <p className="text-sm text-gray-600">{profile.bank_account_name} — {profile.bank_account_number}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-amber-800 font-medium">No bank details on file.</p>
                <p className="text-xs text-amber-700 mt-1">
                  <Link to="/vendor/profile" className="underline font-semibold">Update your profile</Link> to add bank details before submitting invoices.
                </p>
              </div>
            )}

            {profile.bank_name && (
              <div>
                <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankConfirmSame}
                    onChange={(e) => setBankConfirmSame(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-gray-300 text-zammsa-green focus:ring-zammsa-green"
                  />
                  <span className="text-sm text-gray-700">I confirm the bank details above are correct for payment</span>
                </label>

                {!bankConfirmSame && (
                  <div className="mt-4 border border-amber-200 rounded-xl p-4 bg-amber-50">
                    <p className="text-sm font-bold text-amber-800 mb-3">Update Bank Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Bank Name</label>
                        <input value={updateBankName} onChange={(e) => setUpdateBankName(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Account Number</label>
                        <input value={updateBankAccount} onChange={(e) => setUpdateBankAccount(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Account Holder</label>
                        <input value={updateBankHolder} onChange={(e) => setUpdateBankHolder(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <FileUpload
                      label="Bank Confirmation Letter (required for update)"
                      accept=".pdf"
                      file={bankLetterFile}
                      onChange={setBankLetterFile}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {totalInvoiceAmount > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Summary</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Invoice Amount</span>
                <span className="font-bold text-gray-900">K {totalInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Retention (5%) — withheld per contract terms</span>
                <span className="font-bold text-amber-600">- K {retentionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-blue-200 pt-3 flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">Net Payable</span>
                <span className="text-xl font-black text-zammsa-green">
                  K {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 italic pt-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                Payment deadline: 30 days from invoice approval
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
            disabled={createAndSubmitMutation.isPending || overageWarnings.length > 0}
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

function FileUpload({
  label, accept, file, onChange, required,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          required={required && !file}
        />
        <div className={`w-full border-2 border-dashed rounded-xl px-4 py-3 text-sm flex items-center justify-between transition-all ${file ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
          <span className={file ? 'text-zammsa-green font-semibold truncate mr-2' : 'text-gray-400'}>
            {file ? file.name : `Upload ${label}`}
          </span>
          {file && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="text-xs text-red-500 font-bold hover:underline shrink-0">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SubmitInvoice;
