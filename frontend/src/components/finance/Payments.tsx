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
    mutationFn: ({ paymentId, invoiceId }: { paymentId: string; invoiceId: string }) =>
      financeApi.bankConfirmPayment(invoiceId, { status: 'confirmed', bank_reference: `BNK-${Date.now()}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment bank confirmation submitted');
    },
    onError: () => toast.error('Failed to confirm payment'),
  });

  const sendAdviceMutation = useMutation({
    mutationFn: (invoiceId: string) => financeApi.sendPaymentAdvice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment advice sent');
    },
    onError: () => toast.error('Failed to send payment advice'),
  });

  const columns = [
    { key: 'reference', label: 'Reference', render: (v: string, row: any) => (
      <span className="font-medium cursor-pointer hover:text-zammsa-green"
        onClick={() => navigate(`/finance/invoices/${row.invoice}/approval`)}>
        {v || '-'}
      </span>
    )},
    { key: 'invoice', label: 'Invoice', render: (v: string, row: any) => (
      <span className="cursor-pointer hover:text-zammsa-green"
        onClick={() => navigate(`/finance/invoices/${v}/approval`)}>
        {v?.slice(0, 8) || '-'}
      </span>
    )},
    { key: 'vendor', label: 'Vendor' },
    { key: 'amount', label: 'Amount', render: (v: number) => v?.toLocaleString() },
    { key: 'payment_date', label: 'Date', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'payment_method', label: 'Method', render: (v: string) => v?.replace(/_/g, ' ') },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
    { key: 'id', label: 'Actions', render: (_: any, row: any) => (
      <div className="flex gap-1">
        {row.status === 'sent' && (
          <button onClick={() => confirmMutation.mutate({ paymentId: row.payment_id || row.id, invoiceId: row.invoice })}
            disabled={confirmMutation.isPending}
            className="px-2 py-1 bg-emerald-500 text-white text-xs rounded-lg">
            Confirm
          </button>
        )}
        {row.status === 'confirmed' && !row.payment_advice_sent && (
          <button onClick={() => sendAdviceMutation.mutate(row.invoice)}
            disabled={sendAdviceMutation.isPending}
            className="px-2 py-1 bg-blue-500 text-white text-xs rounded-lg">
            Send Advice
          </button>
        )}
        {row.invoice && (
          <button onClick={() => navigate(`/finance/invoices/${row.invoice}/approval`)}
            className="px-2 py-1 bg-gray-500 text-white text-xs rounded-lg">
            View
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search payments..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={data?.results || []} />
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize}
            totalItems={data.count} onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default Payments;
