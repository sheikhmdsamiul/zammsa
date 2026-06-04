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
  const [newInvoice, setNewInvoice] = useState({ contract: '', invoice_number: '', po_number: '', amount: '', due_date: '', description: '' });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const { data: contractsData } = useQuery({
    queryKey: ['vendor-contracts-for-invoice'],
    queryFn: () => vendorApi.contracts.list({ page_size: 100, status: 'active' }),
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
    if (!newInvoice.contract) {
      toast.error('Please select a contract');
      return;
    }
    if (!newInvoice.amount || Number(newInvoice.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!newInvoice.due_date) {
      toast.error('Please select a due date');
      return;
    }
    if (!invoiceFile) {
      toast.error('Please upload the invoice document (PDF)');
      return;
    }

    try {
      const form = new FormData();
      form.append('contract', newInvoice.contract);
      if (newInvoice.invoice_number) form.append('invoice_number', newInvoice.invoice_number);
      if (newInvoice.po_number) form.append('po_number', newInvoice.po_number);
      form.append('amount', newInvoice.amount);
      form.append('due_date', newInvoice.due_date);
      form.append('description', newInvoice.description);
      form.append('document', invoiceFile);
      
      await vendorApi.invoices.create(form);
      toast.success('Invoice submitted successfully');
      setShowForm(false);
      setNewInvoice({ contract: '', invoice_number: '', po_number: '', amount: '', due_date: '', description: '' });
      setInvoiceFile(null);
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit invoice');
    }
  };

  const contracts = contractsData?.results || [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices & Payments</h1>
          <p className="text-gray-500 mt-1 text-lg">Submit invoices and track your payment status</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 ${
            showForm ? 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50' : 'bg-zammsa-green text-white hover:bg-zammsa-green-dark'
          }`}
        >
          {showForm ? 'Cancel' : (
            <>
              <span className="text-xl">+</span> Submit New Invoice
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-zammsa-green/10 rounded-full flex items-center justify-center">
              <span className="text-zammsa-green font-bold">1</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contract / PO</label>
              <select
                value={newInvoice.contract}
                onChange={(e) => setNewInvoice((f) => ({ ...f, contract: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all"
              >
                <option value="">Select an active contract...</option>
                {contracts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} - {c.title || 'Supply Contract'} (ZMW {Number(c.value).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number</label>
              <input 
                value={newInvoice.invoice_number} 
                onChange={(e) => setNewInvoice((f) => ({ ...f, invoice_number: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all" 
                placeholder="Leave blank to auto-generate" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (ZMW) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-gray-400">K</span>
                <input 
                  type="number" 
                  value={newInvoice.amount} 
                  onChange={(e) => setNewInvoice((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all" 
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date <span className="text-rose-500">*</span></label>
              <input 
                type="date" 
                value={newInvoice.due_date} 
                onChange={(e) => setNewInvoice((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Document (PDF) <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className={`w-full border-2 border-dashed rounded-xl px-4 py-3 text-sm flex items-center justify-between transition-all ${invoiceFile ? 'border-zammsa-green bg-zammsa-green/5' : 'border-gray-200 bg-gray-50'}`}>
                  <span className={invoiceFile ? 'text-zammsa-green font-semibold' : 'text-gray-400'}>
                    {invoiceFile ? invoiceFile.name : 'Click to select PDF document'}
                  </span>
                  <svg className={`w-5 h-5 ${invoiceFile ? 'text-zammsa-green' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description / Notes</label>
              <textarea 
                value={newInvoice.description} 
                onChange={(e) => setNewInvoice((f) => ({ ...f, description: e.target.value }))} 
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-zammsa-green/20 focus:border-zammsa-green outline-none transition-all" 
                placeholder="Details of goods or services provided..."
              />
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button 
              onClick={submitInvoice} 
              className="px-8 py-3 bg-zammsa-green text-white rounded-xl font-bold hover:bg-zammsa-green-dark shadow-lg shadow-zammsa-green/20 transition-all flex items-center gap-2"
            >
              Submit for Processing
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Status</label>
          <select 
            value={status} 
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="pending_matching">In Review (Matching)</option>
            <option value="pending_approval">Awaiting Approval</option>
            <option value="approved">Approved for Payment</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">From Date</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">To Date</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-zammsa-green/20 outline-none" />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : !data?.results?.length ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📄</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900">No invoices found</h3>
          <p className="text-gray-400 mt-1 max-w-xs mx-auto">Start by submitting your first invoice for an active contract.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.results.map((inv: any) => (
            <div key={inv.invoice_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-zammsa-green/30 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-zammsa-green transition-colors">
                      {inv.invoice_number || 'Unnamed Invoice'}
                    </h3>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6 text-sm">
                    <div>
                      <span className="text-gray-400 block text-xs font-medium uppercase">Contract</span>
                      <span className="text-gray-700 font-medium">{inv.contract_number}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-xs font-medium uppercase">Due Date</span>
                      <span className="text-gray-700 font-medium">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-gray-400 block text-xs font-medium uppercase">Submitted</span>
                      <span className="text-gray-700 font-medium">{new Date(inv.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 pt-4 md:pt-0 border-gray-50">
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 leading-none">
                      <span className="text-sm font-normal text-gray-400 mr-1">ZMW</span>
                      {Number(inv.amount)?.toLocaleString()}
                    </p>
                    {inv.paid_at && (
                      <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1 justify-end">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        Paid {new Date(inv.paid_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {inv.document && (
                    <button 
                      onClick={() => vendorApi.invoices.downloadPDF(inv.invoice_id)}
                      className="text-sm text-zammsa-green font-bold hover:underline mt-2 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View PDF
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.count > pageSize && (
        <div className="mt-8 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <Pagination 
            currentPage={page} 
            totalPages={Math.ceil(data.count / pageSize)} 
            pageSize={pageSize}
            totalItems={data.count} 
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} 
          />
        </div>
      )}
    </div>
  );
};

export default Invoices;
