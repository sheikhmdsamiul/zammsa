import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const PAGE_SIZE = 10;

const Invoices: React.FC = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [showForm, setShowForm] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ contract: '', invoice_number: '', po_number: '', amount: '', description: '' });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const { data: contractsData } = useQuery({
    queryKey: ['vendor-contracts-for-invoice'],
    queryFn: () => vendorApi.contracts.list({ page_size: 100 }),
  });

  const params: Record<string, any> = { page, page_size: pageSize };
  if (status) params.status = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-invoices', params],
    queryFn: () => vendorApi.invoices.list(params),
  });

  const submitInvoice = async () => {
    if (!newInvoice.contract || !newInvoice.amount) {
      toast.error('Contract and amount are required');
      return;
    }
    try {
      const form = new FormData();
      form.append('contract', newInvoice.contract);
      if (newInvoice.invoice_number) form.append('invoice_number', newInvoice.invoice_number);
      if (newInvoice.po_number) form.append('po_number', newInvoice.po_number);
      form.append('amount', newInvoice.amount);
      form.append('description', newInvoice.description);
      if (invoiceFile) form.append('document', invoiceFile);
      await vendorApi.invoices.create(form);
      toast.success('Invoice submitted');
      setShowForm(false);
      setNewInvoice({ contract: '', invoice_number: '', po_number: '', amount: '', description: '' });
      setInvoiceFile(null);
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit invoice');
    }
  };

  const contracts = contractsData?.results || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage your invoices and payments</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">
          {showForm ? 'Cancel' : 'New Invoice'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Submit New Invoice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract</label>
              <select
                value={newInvoice.contract}
                onChange={(e) => setNewInvoice((f) => ({ ...f, contract: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm"
              >
                <option value="">Select contract...</option>
                {contracts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} - {c.vendor_name} (K {c.value?.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input value={newInvoice.invoice_number} onChange={(e) => setNewInvoice((f) => ({ ...f, invoice_number: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm" placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
              <input value={newInvoice.po_number} onChange={(e) => setNewInvoice((f) => ({ ...f, po_number: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm" placeholder="Defaults to contract number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZMW)</label>
              <input type="number" value={newInvoice.amount} onChange={(e) => setNewInvoice((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={newInvoice.description} onChange={(e) => setNewInvoice((f) => ({ ...f, description: e.target.value }))} rows={2}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Document (PDF)</label>
              <input type="file" accept=".pdf" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
          </div>
          <button onClick={submitInvoice} className="mt-4 px-6 py-2 bg-zammsa-green text-white rounded-lg text-sm hover:bg-zammsa-green-dark">
            Submit Invoice
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm w-44">
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="pending_matching">Pending Match</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm" />
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400">No invoices found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.results.map((inv: any) => (
            <div key={inv.invoice_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{inv.invoice_number || 'Draft'}</h3>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="text-sm text-gray-500">Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</p>
                  {inv.paid_at && <p className="text-sm text-gray-500">Paid: {new Date(inv.paid_at!).toLocaleDateString()}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{Number(inv.amount)?.toLocaleString()} ZMW</p>
                  {inv.document && (
                    <button onClick={() => vendorApi.invoices.downloadPDF(inv.invoice_id)}
                      className="text-xs text-zammsa-green hover:underline mt-1">Download PDF</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize}
          totalItems={data.count} onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
};

export default Invoices;
