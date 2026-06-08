import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vendorApi } from '../../api/vendor';
import { StatusBadge } from '../common/StatusBadge';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const PAGE_SIZE = 10;

const Invoices: React.FC = () => {
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const params: Record<string, any> = { page, page_size: pageSize };
  if (status) params.status = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-invoices', params],
    queryFn: () => vendorApi.invoices.list(params),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices & Payments</h1>
          <p className="text-gray-500 mt-1 text-lg">Submit invoices and track your payment status</p>
        </div>
        <Link
          to="/vendor/invoices/new"
          className="px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 bg-zammsa-green text-white hover:bg-zammsa-green-dark"
        >
          <span className="text-xl">+</span> Submit New Invoice
        </Link>
      </div>

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
