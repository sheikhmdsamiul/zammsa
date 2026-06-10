import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '../../api/finance';
import { DataTable } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import { SearchBar } from '../common/SearchBar';
import { Pagination } from '../common/Pagination';
import { LoadingSpinner } from '../common/LoadingSpinner';

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, pageSize, search],
    queryFn: () => financeApi.listInvoices({ page, page_size: pageSize, search }),
  });

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', render: (v: string) => <span className="font-medium">{v}</span> },
    { key: 'contract_number', label: 'Contract' },
    { key: 'amount', label: 'Amount', render: (v: number) => v?.toLocaleString() },
    { key: 'due_date', label: 'Due Date', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'paid_at', label: 'Paid Date', render: (v: string | null) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <SearchBar value={search} onChange={setSearch} placeholder="Search invoices..." />
        </div>
        {isLoading ? <LoadingSpinner className="py-12" /> : (
          <DataTable columns={columns} data={data?.results || []} onRowClick={(row) => navigate(`/finance/invoices/${row.id}/approval`)} />
        )}
        {data && (
          <Pagination currentPage={page} totalPages={Math.ceil(data.count / pageSize)} pageSize={pageSize}
            totalItems={data.count} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default Invoices;
