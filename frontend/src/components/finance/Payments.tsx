import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { CashIcon } from '@heroicons/react/outline';

const Payments: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, pageSize, search],
    queryFn: () => financeApi.listPayments({ page, page_size: pageSize, search }),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) =>
      financeApi.bankConfirmPayment(invoiceId, { status: 'confirmed', bank_reference: `BNK-${Date.now()}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment confirmed successfully');
    },
    onError: () => toast.error('Failed to confirm payment'),
  });

  const sendAdviceMutation = useMutation({
    mutationFn: (invoiceId: string) => financeApi.sendPaymentAdvice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment advice sent to supplier');
    },
    onError: () => toast.error('Failed to send payment advice'),
  });

  const columns = [
    { 
      key: 'processed_at', 
      label: 'Date', 
      render: (v: string) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{v ? new Date(v).toLocaleDateString() : '-'}</span>
          <span className="text-xs text-gray-400">{v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      )
    },
    { 
      key: 'invoice_number', 
      label: 'Invoice', 
      render: (v: string, row: any) => (
        <button 
          onClick={() => navigate(`/finance/invoices/${row.invoice}/approval`)}
          className="font-bold text-zammsa-green hover:underline flex flex-col items-start"
        >
          <span>{v || 'INV-' + row.invoice?.slice(0, 8)}</span>
          <span className="text-[10px] text-gray-400 font-normal uppercase tracking-tighter">View Details</span>
        </button>
      )
    },
    { 
      key: 'vendor', 
      label: 'Supplier',
      render: (v: string) => <span className="text-sm font-medium text-gray-700">{v || 'N/A'}</span>
    },
    { 
      key: 'amount', 
      label: 'Amount (ZMW)', 
      render: (v: number) => (
        <span className="text-base font-black text-gray-900">
          {Number(v)?.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'payment_method', 
      label: 'Method', 
      render: (v: string) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
          {v?.replace(/_/g, ' ')}
        </span>
      )
    },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { 
      key: 'id', 
      label: 'Actions', 
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          {row.status === 'sent' && (
            <button 
              onClick={(e) => { e.stopPropagation(); confirmMutation.mutate({ invoiceId: row.invoice }); }}
              disabled={confirmMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-sm transition-all"
            >
              Confirm Bank
            </button>
          )}
          {row.status === 'confirmed' && !row.payment_advice_sent && (
            <button 
              onClick={(e) => { e.stopPropagation(); sendAdviceMutation.mutate(row.invoice); }}
              disabled={sendAdviceMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm transition-all"
            >
              Send Advice
            </button>
          )}
          <button 
            onClick={() => navigate(`/finance/invoices/${row.invoice}/approval`)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="View Details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Financial Disbursements</h1>
          <p className="text-gray-500 mt-1 text-lg font-medium">Tracking and confirming bank payments</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/30">
          <div className="max-w-md">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by vendor or invoice..." />
          </div>
        </div>
        
        {isLoading ? (
          <div className="py-32">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable columns={columns} data={data?.results || []} />
          </div>
        )}
        
        {data && data.count > pageSize && (
          <div className="p-6 border-t border-gray-50">
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
      
      {!isLoading && !data?.results?.length && (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CashIcon className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No payment records found</h3>
          <p className="text-gray-500 mt-1 max-w-xs mx-auto">All processed payments will appear here for confirmation and advice sending.</p>
        </div>
      )}
    </div>
  );
};

export default Payments;
